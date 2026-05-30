# RoBrain

**Shared memory across your team and your AI agents — with judgment about what's worth keeping.**

Most agent-memory tools stop at capture — they store what happened and hope you query it later. RoBrain is built around a different question: **what is worth keeping, and what should surface before the agent acts again?** Passive capture records every decision and the alternatives your team ruled out; batch **Synthesis** reads the whole corpus to flag contradictions, drift, and recurring entities that no single session could see.

> The cost of forgetting a rejection isn't inefficiency. It's the auth bypass you already patched, the migration you already rolled back, the dependency you already removed for a CVE — re-suggested by an agent with no memory of why you said no.

Open-source, self-hosted Postgres. Works with **Claude Code, Cursor, GitHub Copilot (VS Code), and Codex CLI**.

Coding is the first vertical because the feedback loops are tight — reverts, incidents, and rework make the cost of a forgotten rejection measurable. The same architecture applies wherever agents make decisions that outlast a session.

RoBrain is built by [Rory Plans](https://roryplans.ai), an agent orchestration platform; it is the memory and judgment layer that keeps multi-agent, multi-developer work coherent over time.

---

## How it works (short)

**Tuesday — experienced teammate in Cursor:** The team is shipping Perception as a small Hono server. They consider porting to Express so contributors have a familiar stack, but settle on Hono: it runs on Bun and edge runtimes without a rewrite, and the API is already Express-shaped (`app.get`, middleware chain). RoBrain captures the decision and the rejected Express path automatically — no manual tagging required.

**Wednesday — new teammate in Claude Code:** A fresh session has no memory of Tuesday. They ask whether Perception should move to Express — a reasonable question if you only see the repo today. With RoBrain wired in, the agent pulls the prior decision (<strong><span style="color:#6d4aa3">always-on summary</span></strong> at session start, or `npx robrain inject` for a focused pull) and pushes back with the recorded rationale: deliberate Hono choice, marginal familiarity upside, real cost in locking out edge deploy and churn on a working server. The team does not re-litigate from zero.

That is the handoff RoBrain is built for: **Cursor Tuesday → Claude Code Wednesday**, same Postgres store, same structured vetoes — captured passively, surfaced before the agent steers you down a path you already rejected.

Full walkthrough: **[Concepts — How it works](docs/concepts.md#how-it-works)**.

---

## Two pillars

### Capture (reactive)

Sensing records session turns; Perception extracts decisions without the agent choosing what to remember. Every row can carry **`rejected[]`** — structured vetoes that are the substrate for pre-task warnings, not a marketing bullet on their own.

### Judgment (corpus-wide)

**Synthesis** runs three passes over the full `decisions` table: **drift** (stance moving without an explicit reversal), **contradictions** (pairs of incompatible decisions from different sessions), and **entity promotion** (recurring tools/patterns condensed into `planning_blocks`). Perception flags conflicts at write time; Synthesis catches what reactive capture missed. **`robrain review`** and the <strong><span style="color:#6d4aa3">always-on summary</span></strong> keep only what you trust.

That is what “judgment about what's worth keeping” looks like in code — not another grep over chat logs.

---

## What you get

- **Capture** decisions automatically — every turn classified, no agent involvement
- **Query** vetoes as structured `rejected[]` fields in Postgres
- **Catch** contradictions and drift across the corpus
- **Hand off** context across tools and developers
- **Explain** any file's history with `npx robrain explain`

---

## Quick start — self-hosted

First `pnpm docker:up` auto-creates `.env` and fills `PERCEPTION_API_KEY` / `POSTGRES_PASSWORD`. Perception still needs your LLM + embedding keys before it stays up.

**One-time — RoBrain repo:**

```bash
git clone https://github.com/adelinamart/robrain
cd robrain
pnpm install && pnpm build
pnpm docker:up                 # first run: creates .env; Perception won't start yet
# open .env, add ANTHROPIC_API_KEY + your embedding key (e.g. OPENAI_API_KEY)
pnpm docker:up                 # second run: Perception now boots
npx robrain install --self-hosted --repo-root "$(pwd)"
```

OpenAI-only: set `LLM_PROVIDER=openai` and `OPENAI_API_KEY` instead of Anthropic — see [Concepts — Prefer not to use Anthropic](docs/concepts.md#prefer-not-to-use-anthropic-run-openai-only).

**Per application project:**

```bash
cd /path/to/your/project
npx robrain init-project
```

**Corpus judgment** (manual once, or add to cron):

```bash
npx robrain synth
```

Synthesis writes contradiction flags, drift signals, and entity summaries into your DB — review with `npx robrain review`. It does not capture new decisions; it judges what you already have.

**Git-committed decision ledger** (opt-in):

```bash
npx robrain review              # optional — inspect/approve captured decisions in the CLI
npx robrain export-memory --ledger
# custom path: npx robrain export-memory --ledger docs/decisions.md
```

Use `review` when you want to see what is being recorded and approve or reject rows before regenerating `decisions.md` for git — skip it if you are fine exporting straight from the DB.

After `init-project`, every repo gets `CLAUDE.md` and `AGENTS.md` (Codex CLI), and Cursor also gets `.cursor/rules/robrain.mdc` with `alwaysApply: true` — capture setup is automatic.

**Next:** [CLI reference — Install and setup](docs/cli.md#install-and-setup) · [Troubleshooting](docs/troubleshooting.md) if captures do not land.

### Upgrading

When a new release ships, from your **robrain clone**: `git pull` → `pnpm install && pnpm build` → `pnpm docker:up:build` → `npx robrain install --self-hosted --repo-root "$(pwd)"` → fully restart editors (quit the app, not just the chat). If you use `npm install -g robrain`, run `npm install -g robrain@latest` **and** still rebuild Docker from the clone.

Full checklist: **[CLI reference — Upgrading](docs/cli.md#upgrading)**.

---

## Compared to other memory tools

Versus **Mem0**, **Cloudflare Agent Memory**, and **Claude Code Auto-Memory**: only RoBrain stores rejected alternatives as structured fields and runs scheduled corpus-wide contradiction scans. **[Full comparison →](docs/concepts.md#comparisons)**

### Self-hosted vs Rory Plans cloud

| Feature | Free / self-hosted | Rory Plans cloud |
|---------|-------------------|------------------|
| Passive session capture | ✓ | ✓ |
| `rejected[]` field as structured data | ✓ | ✓ |
| Decision lifecycle (active / superseded / invalidated) | ✓ | ✓ |
| Cross-tool MCP — Claude Code, Cursor, Copilot, Codex CLI | ✓ | ✓ |
| Classifier LLM choice — Anthropic Haiku or OpenAI | ✓ | ✓ |
| <strong><span style="color:#6d4aa3">Always-on summary</span></strong> at session start | ✓ | ✓ |
| `npx robrain review` | ✓ | ✓ |
| `npx robrain inject` (manual paste) | ✓ | ✓ |
| `npx robrain explain <file>` | ✓ | ✓ |
| `npx robrain export-memory` → Claude auto-memory + ledger | ✓ | ✓ |
| Synthesis — drift, contradictions, entity promotion | ✓ | ✓ |
| Decision graph (`conflicts_with` / `extends` / `related_to`) | ✓ | ✓ |
| Self-host on your infrastructure | ✓ | — |
| Your data stays local | ✓ | processed remotely |
| Calibrated extraction prompt (fewer false positives) | — | ✓ |
| Calibrated 4-way contradiction taxonomy (page-12 model) | — | ✓ |
| Automatic injection at task boundaries | — | ✓ |
| Pre-task `rejected[]` warning | — | ✓ |
| Disengagement protocol (⚠ acknowledgement) | — | ✓ |
| Full 5-signal relevance scorer | — | ✓ |
| Conflict auto-resolution + dashboard visualizations | — | ✓ |
| Team memory — managed multi-user store | — | ✓ |
| Web dashboard | — | ✓ |

Self-hosted gives capture, judgment batch jobs, and session-start recall; you pull focused context with `inject` when needed. Cloud adds Planning + Control so vetoes and conflicts surface before the agent acts.

Details: **[Concepts — Free / self-hosted vs Rory Plans cloud](docs/concepts.md#free--self-hosted-vs-rory-plans-cloud)**.

---

## Run Synthesis

Synthesis writes contradiction flags, drift signals, and entity summaries into your DB (`planning_blocks`, relation edges). Review what it finds with **`robrain review`** — it does not capture new decisions; it judges the corpus you already have.

```bash
pnpm synthesis:build && pnpm synthesis:run
# or: npx robrain synth
```

Deep dive (three passes, cron, env vars): **[Concepts — Synthesis](docs/concepts.md#synthesis)**.

---

## What's next

Connecting decisions to outcomes (reverts, incidents, cycle time) so RoBrain can surface when a team is optimizing for the wrong thing in its own codebase.

---

## Documentation

| Guide | What you'll find |
|-------|------------------|
| **[Concepts](docs/concepts.md)** | How it works, two pillars (capture + judgment), Synthesis, comparisons |
| **[CLI reference](docs/cli.md)** | `explain` examples, install, upgrading, editor setup, full command table |
| **[Troubleshooting](docs/troubleshooting.md)** | Silent 401s, Docker rebuilds, stale summaries, verification |

---

## Contributing

Apache 2.0. PRs welcome for extraction accuracy, new editor integrations, and embedding providers. See [Concepts — Reference](docs/concepts.md#reference) for tradeoffs and schema.

## License

Apache 2.0 — see [LICENSE](./LICENSE)

Built by [Rory Plans](https://roryplans.ai)
