"""HTTP client for RoBrain's self-hosted Perception API.

RoBrain (https://github.com/adelinamart/robrain) is a self-hosted decision
memory: it records what a team decided AND the alternatives it explicitly
rejected (a structured ``rejected[]`` field per decision), stores both in
the user's own Postgres, and serves them back ranked by a 5-signal
composite score. Nothing leaves the user's machine.

This client covers the three Perception endpoints the Hermes provider
needs:

  GET  /projects/:id/summary  — the always-on summary (session-start recall)
  GET  /decisions?query=...   — composite-scored semantic retrieval
  POST /signals               — raw-turn capture; Perception extracts the
                                decision server-side (needs_classification)

Auth is a static bearer token (``PERCEPTION_API_KEY`` from the RoBrain
deployment's .env). All calls carry short timeouts and raise
``RoBrainClientError`` — callers are expected to fail open: memory being
down should degrade recall, never block the agent.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

import requests

logger = logging.getLogger(__name__)

DEFAULT_BASE_URL = "http://localhost:3001"
DEFAULT_PROJECT_ID = "default"

_READ_TIMEOUT = 6    # summary / search — user-visible latency path
_WRITE_TIMEOUT = 45  # /signals runs LLM extraction + embedding server-side
                     # before responding; writes happen on a background
                     # thread, so a generous timeout costs no turn latency


class RoBrainClientError(Exception):
    """Raised for any transport or non-2xx failure against Perception."""


class RoBrainClient:
    """Thin, dependency-light wrapper over the Perception HTTP API."""

    def __init__(
        self,
        base_url: str = DEFAULT_BASE_URL,
        api_key: str = "",
        project_id: str = DEFAULT_PROJECT_ID,
    ) -> None:
        self.base_url = (base_url or DEFAULT_BASE_URL).rstrip("/")
        self.api_key = api_key
        self.project_id = project_id or DEFAULT_PROJECT_ID
        self._session = requests.Session()

    # -- internals ----------------------------------------------------------

    def _headers(self, extra: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        if extra:
            headers.update(extra)
        return headers

    def _request(self, method: str, path: str, *, timeout: float, **kwargs) -> Any:
        url = f"{self.base_url}{path}"
        try:
            resp = self._session.request(
                method, url, headers=self._headers(kwargs.pop("extra_headers", None)),
                timeout=timeout, **kwargs,
            )
        except requests.RequestException as exc:
            raise RoBrainClientError(f"{method} {path}: {exc}") from exc
        if resp.status_code >= 400:
            raise RoBrainClientError(
                f"{method} {path}: HTTP {resp.status_code} — {resp.text[:200]}"
            )
        try:
            return resp.json()
        except ValueError as exc:
            raise RoBrainClientError(f"{method} {path}: non-JSON response") from exc

    # -- API surface ---------------------------------------------------------

    def health(self) -> bool:
        """True when Perception answers /health (unauthenticated by design)."""
        try:
            self._request("GET", "/health", timeout=3)
            return True
        except RoBrainClientError:
            return False

    def get_summary(self) -> Dict[str, Any]:
        """Fetch the project's always-on summary.

        Returns ``{"always_on_summary": str | None, "mission": str | None}``.
        404 (project not registered) raises like any other error — the
        provider treats it as "no summary yet", not a hard failure.
        """
        return self._request(
            "GET", f"/projects/{self.project_id}/summary", timeout=_READ_TIMEOUT,
        )

    def search_decisions(
        self,
        query: str,
        *,
        limit: int = 5,
        boost_files: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """Composite-scored semantic retrieval over the decision corpus.

        Each row carries ``decision``, ``rationale``, ``rejected`` (list of
        ``{option, reason}``), ``planning_score``, lifecycle fields, etc.
        """
        params: Dict[str, str] = {
            "project_id": self.project_id,
            "query": query,
            "limit": str(limit),
        }
        if boost_files:
            params["boost_files"] = ",".join(boost_files)
        payload = self._request("GET", "/decisions", timeout=_READ_TIMEOUT, params=params)
        rows = payload.get("decisions") if isinstance(payload, dict) else payload
        return rows if isinstance(rows, list) else []

    def post_turn_signal(
        self,
        *,
        session_id: str,
        sequence: int,
        user_message: str,
        assistant_message: str,
        timestamp: str,
        scope: str = "team",
    ) -> Dict[str, Any]:
        """Ship a raw turn; Perception extracts the decision server-side.

        ``needs_classification: true`` bypasses the confidence gate and makes
        Perception run its own extraction (the flush-on-close path), so this
        client needs no LLM of its own. Perception also re-redacts secrets
        before anything is embedded or stored.
        """
        body = {
            "signal": {
                "turn": {
                    "session_id": session_id,
                    "sequence": sequence,
                    "user_message": user_message,
                    "claude_reply": assistant_message,
                    "files_touched": [],
                    "timestamp": timestamp,
                },
                "decision_type": "unclassified",
                "confidence": 0,
                "files_affected": [],
                "scope": scope,
                "needs_classification": True,
            }
        }
        return self._request(
            "POST", "/signals", timeout=_WRITE_TIMEOUT, json=body,
            extra_headers={"X-Project-Id": self.project_id},
        )
