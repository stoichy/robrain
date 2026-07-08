# RoBrain memory provider

[RoBrain](https://github.com/adelinamart/robrain) is self-hosted decision
memory: it passively captures what got decided in your sessions **and the
alternatives you explicitly ruled out**, storing each veto as a structured
`rejected[]` field (option + reason) in your own Postgres. Recall is ranked
by a 5-signal composite score (semantic similarity, file overlap, recency,
historical relevance, approval state). Nothing leaves your machine.

The differentiator over fact-style memory: a rejection survives as data, not
prose. When a task drifts toward something you already declined, the veto
arrives in context as an explicit warning with the original reason —
`REJECTED: Redis — second datastore to operate; ops budget is one datastore`.

## What the provider does

| Hermes hook | RoBrain behavior |
|---|---|
| system prompt | Injects the project's always-on summary (top decisions + vetoes) at session start |
| prefetch | Background semantic retrieval per turn; rejected alternatives rendered as `REJECTED:` warnings |
| sync_turn | Ships each turn to Perception, which runs its own server-side decision extraction — no local LLM, no extra API key |
| `robrain_search` tool | On-demand decision + veto lookup before the agent commits to an approach |

Fail-open: if the Perception API is down, recall degrades to nothing and
writes are dropped with a log warning — the agent never blocks. Writes are
skipped in cron/subagent contexts so system prompts never pollute the
decision corpus. Previously injected memory context is stripped before
capture, so recall can't re-enter the corpus as a fresh "decision".

## Setup

This is a **standalone Hermes plugin** — hermes-agent's contribution policy
asks memory providers to ship outside their tree, installed into
`$HERMES_HOME/plugins/` where Hermes' plugin discovery picks them up with
the same lifecycle hooks as bundled providers.

1. Run RoBrain (~2 minutes — [install guide](https://github.com/adelinamart/robrain#install)):

   ```bash
   # No clone:
   npx robrain@latest up
   # Or from a clone:
   git clone https://github.com/adelinamart/robrain && cd robrain
   pnpm install && pnpm build && pnpm docker:up
   ```

   Add `ANTHROPIC_API_KEY` and your embedding key to `~/.robrain/stack/.env` (after `robrain up`) or the repo `.env` (clone path), then ensure Perception is healthy: `curl -sf http://localhost:3001/health`.

2. Install the plugin (from your robrain checkout; `$HERMES_HOME` defaults
   to `~/.hermes` on macOS/Linux):

   ```bash
   cp -r integrations/hermes/robrain "${HERMES_HOME:-$HOME/.hermes}/plugins/robrain"
   ```

3. Point Hermes at it:

   ```bash
   hermes memory setup    # select "robrain"
   ```

   You'll be asked for:
   - **base_url** — Perception's URL (default `http://localhost:3001`)
   - **project_id** — your RoBrain project (default `default`)
   - **scope** — recorded on captured decisions (default `team`)
   - **PERCEPTION_API_KEY** — from `~/.robrain/stack/.env` (after `robrain up`) or the repo `.env` (clone path)

Config lands in `$HERMES_HOME/robrain/config.json` (non-secrets) and the
profile env store (the key). Env fallbacks for headless setups:
`ROBRAIN_BASE_URL`, `ROBRAIN_PROJECT_ID`, `PERCEPTION_API_KEY`.

## Notes

- Decisions captured from Hermes sessions land in the same Postgres store
  RoBrain fills from Claude Code, Cursor, Copilot, and Codex CLI — one
  shared decision memory across your tools. Review captures with
  `npx robrain review`; batch judgment (contradictions, drift) with
  `npx robrain synth`.
- Perception re-redacts secrets server-side before anything is embedded or
  stored, and RoBrain supports a fully-local mode (OpenAI-compatible local
  server for extraction + embeddings) if you want zero external LLM calls.
- Requires a reachable RoBrain deployment; there is no hosted default.

## Running the tests

The test suite (`../test_robrain_provider.py`) runs against a hermes-agent
checkout, since it exercises the real `MemoryProvider` ABC:

```bash
git clone https://github.com/NousResearch/hermes-agent
cp -r integrations/hermes/robrain hermes-agent/plugins/memory/robrain
cp integrations/hermes/test_robrain_provider.py hermes-agent/tests/plugins/memory/
cd hermes-agent && python -m pytest tests/plugins/memory/test_robrain_provider.py
```

(21 tests, no network — the HTTP client is stubbed. Verified end-to-end
against a live RoBrain deployment on 2026-07-08: raw Hermes turn →
server-side extraction → decision with structured veto → recall through
both prefetch and the robrain_search tool.)
