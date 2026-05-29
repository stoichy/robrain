# RoBrain

**Shared memory across your team and your AI agents — with judgment about what's worth keeping.**

Most agent-memory tools stop at capture — they store what happened and hope you query it later. RoBrain is built around a different question: **what is worth keeping, and what should surface before the agent acts again?** Passive capture records every decision and the alternatives your team ruled out; batch **Synthesis** reads the whole corpus to flag contradictions, drift, and recurring entities that no single session could see.

The cost of forgetting a rejection is not just inefficiency:

> the auth bypass you already patched, the migration you already rolled back, the dependency you already removed for a CVE.

Open-source, self-hosted Postgres. **Claude Code, Cursor, GitHub Copilot (VS Code), and Codex CLI** — each wired via `robrain install` (Codex: marker-bounded block in `~/.codex/config.toml` + `AGENTS.md` session instructions; see [CLI reference](docs/cli.md#codex-cli-setup)).

RoBrain is built by [Rory Plans](https://roryplans.ai), an agent orchestration platform; it is the memory and judgment layer that keeps multi-agent, multi-developer work coherent over time.

## Documentation

| Guide | What you'll find |
|-------|------------------|
| **[Concepts](docs/concepts.md)** | How it works, two pillars (capture + judgment), Synthesis, comparisons |
| **[CLI reference](docs/cli.md)** | `explain` examples, install, editor setup, full command table |
| **[Troubleshooting](docs/troubleshooting.md)** | Silent 401s, Docker rebuilds, stale summaries, verification |

All guides (repo root):

- [docs/concepts.md](docs/concepts.md)
- [docs/cli.md](docs/cli.md)
- [docs/troubleshooting.md](docs/troubleshooting.md)

---

## Two pillars

### Capture (reactive)

Sensing records session turns; Perception extracts decisions without the agent choosing what to remember. Every row can carry **`rejected[]`** — structured vetoes that are the substrate for pre-task warnings, not a marketing bullet on their own.

### Judgment (corpus-wide)

**Synthesis** runs three passes over the full `decisions` table: **drift** (stance moving without an explicit reversal), **contradictions** (pairs incompatible decisions from different sessions), and **entity promotion** (recurring tools/patterns condensed into `planning_blocks`). Perception flags conflicts at write time; Synthesis catches what reactive capture missed. **`robrain review`** and the always-on summary keep only what you trust.

That is what “judgment about what's worth keeping” looks like in code — not another grep over chat logs.

---

## What ships today

- **Systematic passive capture** — every turn classified; agents do not decide what to remember.
- **`rejected[]` in Postgres** — vetoes as queryable fields; input for inject, cloud Control warnings, and contradiction surfacing.
- **Decision lifecycle** — active vs superseded, linked history, review so memory stays honest.
- **Team-shared store** — one Postgres across machines and MCP editors.
- **Always-on summary at session start** — cross-tool handoffs (Cursor Tuesday → Claude Code Wednesday) without paste.
- **`npx robrain inject` / `explain`** — focused pull and file-scoped “why does this exist?” ([examples](docs/cli.md#why-does-this-code-exist)).
- **Conflict visibility** — flagged contradictions; cloud adds proactive warnings at task boundaries ([comparison](docs/concepts.md#free--self-hosted-vs-rory-plans-cloud)).

---

## How it works (short)

Alice settles on Zustand over Redux in Cursor on Tuesday; RoBrain captures it automatically. Bob opens Claude Code on Wednesday; the always-on summary (or `npx robrain inject`) surfaces the veto before Redux gets suggested again.

Coding is the first vertical because the feedback loops are tight — reverts, incidents, and rework make the cost of a forgotten rejection measurable. The same architecture applies wherever agents make decisions that outlast a session.

Full walkthrough: **[Concepts — How it works](docs/concepts.md#how-it-works)**.

---

## Quick start — self-hosted

From a fresh clone, copy `.env.example` to `.env`, add your `ANTHROPIC_API_KEY` plus one embedding-provider key (or set `LLM_PROVIDER=openai` for OpenAI-only — see [Concepts](docs/concepts.md#prefer-not-to-use-anthropic-run-openai-only)), then run:

```bash
pnpm install && pnpm build
pnpm docker:up
```

These first three commands run once from the `robrain` clone.

```bash
npm install -g robrain
npx robrain install --self-hosted --repo-root "$(pwd)"
```

These commands install the RoBrain package and wire Sensing MCP into your editors.

```bash
cd /path/to/your/project && npx robrain init-project
```

The last command runs once per application repo.

**Next:** [CLI reference — Install and setup](docs/cli.md#install-and-setup) · [Troubleshooting](docs/troubleshooting.md) if captures do not land.

---

## Self-hosted vs Rory Plans cloud

| | Free / self-hosted | Rory Plans cloud |
|---|-------------------|------------------|
| Capture + `rejected[]` + Synthesis + review | ✓ | ✓ |
| Data stays on your machine | ✓ | processed remotely |
| Always-on summary at session start | ✓ | ✓ |
| Automatic injection + rejection warnings at task boundaries | — | ✓ |

Self-hosted gives capture, judgment batch jobs, and session-start recall; you pull focused context with `inject` when needed. Cloud adds Planning + Control so vetoes and conflicts surface before the agent acts.

Details: **[Concepts — Free / self-hosted vs Rory Plans cloud](docs/concepts.md#free--self-hosted-vs-rory-plans-cloud)**.

---

## Run Synthesis

```bash
pnpm synthesis:build && pnpm synthesis:run
# or: npx robrain synth
```

Deep dive (three passes, cron, env vars): **[Concepts — Synthesis](docs/concepts.md#synthesis)**.

---

## What's next

**Next:** connecting decisions to outcomes (reverts, incidents, cycle time) so RoBrain can surface when a team is optimizing for the wrong thing in its own codebase. If you want to help shape that layer, [get in touch via Rory Plans](https://roryplans.ai).

---

## Contributing

Apache 2.0. PRs welcome for extraction accuracy, new editor integrations, and embedding providers. See [Concepts — Reference](docs/concepts.md#reference) for tradeoffs and schema. Full docs: [concepts](docs/concepts.md) · [CLI](docs/cli.md) · [troubleshooting](docs/troubleshooting.md).

## License

Apache 2.0 — see [LICENSE](./LICENSE)

Built by [Rory Plans](https://roryplans.ai)
