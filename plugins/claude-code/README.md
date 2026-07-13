# RoBrain plugin for Claude Code

Claude's memory keeps your best notes. RoBrain keeps the things you decided **not** to do — and hands them back right before they're about to happen again.

The plugin wires three lifecycle hooks into Claude Code, all backed by your self-hosted RoBrain stack:

| Hook | What it does |
|---|---|
| `SessionStart` | Injects the always-on project summary — top decisions **with their rejected alternatives** — into every new session. |
| `UserPromptSubmit` | Two-tier pre-task veto: **tier 1** — `POST /veto-scan` (deterministic exact match on `rejected[]`, no embeddings); **tier 2** — semantic `GET /decisions?query=` for longer prompts. Warns before Claude starts working. |
| `Stop` | Ships the completed turn to Perception for server-side decision extraction (async — never blocks your session). Capture becomes deterministic instead of depending on the model remembering to call MCP tools. |

Every hook fails open: if Perception is down or unconfigured, your session is unaffected.

## Install

Requires a running RoBrain stack and a registered project:

```bash
npx robrain@latest up                  # start Postgres + Perception (no clone needed)
npx robrain init-project               # register this project, warm-start memory
```

Then add the plugin:

```bash
claude plugin marketplace add adelinamart/robrain
claude plugin install robrain@robrain
```

Connection settings come from `~/.robrain/config.json` (written by `robrain up` / `robrain install`); `PERCEPTION_URL` / `PERCEPTION_API_KEY` environment variables override it.

## Notes

- **Works alongside the Sensing MCP.** Perception deduplicates near-identical decisions server-side, so running both double-captures nothing. With the plugin installed, the mandatory `sensing_record_turn` block in `CLAUDE.md` becomes optional — hooks capture deterministically.
- **Cross-tool by design.** Decisions captured here surface in Cursor, Copilot, and Codex through the same Perception store (`robrain install --self-hosted`).
- **Your data stays yours.** Hooks talk only to the Perception URL you configured — by default a Docker container on localhost.
