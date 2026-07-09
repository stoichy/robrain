# Claude's memory keeps your 15 best notes. Who keeps the 50 things you decided NOT to do?

*July 2026 — announcing the RoBrain plugin for Claude Code*

Last week I typed this into Claude Code:

> "let's migrate the vector store from pgvector to Pinecone for better scaling of embeddings"

Before Claude wrote a single line, this appeared in its context:

> ⚠ RoBrain — this task touches decisions with previously REJECTED approaches:
> - Use pgvector in Postgres for embeddings, not Pinecone.
>   Rejected: **Pinecone** (Per-namespace pricing incompatible with cost model at scale)

That rejection was two months old. I had forgotten it. Claude's built-in memory had never held it. The agent was one prompt away from cheerfully re-doing an evaluation we had already paid for — and the warning arrived at the only moment it's worth anything: right before the mistake happens again.

Today we're shipping that as a Claude Code plugin.

## Isn't Claude's memory enough?

Fair question — Claude Code's auto-memory is genuinely good. So before building this, we measured. My machine has run both systems side by side on the same project for 63 days: Claude Code's auto-memory, and RoBrain's decision store, watching the same 99 sessions.

What each retained:

| | RoBrain | Claude Code auto-memory |
|---|---|---|
| Retained units | 102 decisions | 15 memory files (~5,200 words) |
| Decisions with rejected alternatives | **36** (50 rejected options, each with the reason) | **~3**, in prose |

The three rejections Claude's memory kept were all feedback about its own behavior ("use pnpm, never npm", "don't mirror docs"). The engineering vetoes — why Postgres and not SQLite, why the classifier isn't GPT-4o-mini, why not Fastify, not Redux, not npm workspaces, not Pinecone — none of them survived. Two of the 15 memory files, ironically, were written by RoBrain's own export command.

Here's the thing: **that's not a failure of Claude's memory.** It keeps a small, curated working set — the notes it needs on every single turn. It was never trying to be a decision archive. But somebody has to be, because the expensive mistakes aren't forgetting what you chose. They're re-proposing what you already ruled out: the dependency you removed for a CVE, the migration you rolled back, the vendor whose pricing didn't survive contact with your invoice.

Claude's memory keeps your 15 best notes. RoBrain keeps the 50 things you decided NOT to do — and hands them to every tool, right before they're about to happen again.

## What the plugin does

Three hooks, all backed by your own self-hosted stack (Postgres + a small API in Docker — your data never leaves your machine):

1. **Session start** — injects your project's top decisions, with their rejected alternatives, into every new session.
2. **Before every prompt** — searches the decision store with what you just typed. If the task touches a decision that carries a rejection, Claude gets the warning above *before* it starts working.
3. **After every reply** — ships the finished turn for decision extraction. Until now, capture depended on the model remembering to call a memory tool every turn — and models forget. Hooks don't.

Everything fails open: if the backend is down, your session works normally.

And because the store is shared, the same decisions surface in Cursor, Copilot, and Codex — tools that have no built-in memory at all. Decide something in Claude Code on Monday; Cursor knows it on Tuesday.

## Install

```bash
npx robrain@latest up                  # start the stack (Docker, no clone needed)
npx robrain init-project               # register your project

claude plugin marketplace add adelinamart/robrain
claude plugin install robrain@robrain
```

If a teammate has already run `init-project` in your repo, Claude Code will simply offer you the plugin when you open it.

## The honest caveats

The 63-day comparison is one machine, one project, one very motivated user (me — I built this). Treat it as a founder's field note, not a benchmark. For the controlled version, see [VetoBench](../../packages/vetobench/README.md): across memory conditions on identical transcripts, the leading OSS memory tool lost the rejection from its retrieved context in 38% of cases; RoBrain's pipeline preserved 100/100 at extraction and 50/50 at retrieval, with zero re-proposals. Receipts — all 50 cells per condition — are committed in the repo.

Apache 2.0, self-hosted, no account needed: [github.com/adelinamart/robrain](https://github.com/adelinamart/robrain)

<!--
─────────────────────────────────────────────────────────────
LinkedIn variant (post as Adelina, first person):

Claude Code's memory is good. I measured it against my own tool expecting to lose.

63 days, same project, side by side: Claude's auto-memory kept 15 tidy files — my best notes, genuinely useful. It also kept ~3 of the 50 approaches I'd explicitly rejected along the way. Why we're NOT on Pinecone. Why the classifier is NOT GPT-4o-mini. Why NOT SQLite. Gone.

That's not a bug in Claude's memory — it keeps a working set, not an archive. But the expensive mistakes in AI-assisted coding aren't forgotten choices. They're re-proposed rejections: the dependency you removed for a CVE, the migration you rolled back, the vendor pricing that didn't survive your invoice.

So we shipped a Claude Code plugin today. It watches your sessions, keeps every decision WITH the alternatives you ruled out, and — the part I'm proud of — warns the agent right before a rejected approach is about to happen again. I typed "let's migrate to Pinecone" and it threw my own two-month-old rejection back at me, reason included, before Claude wrote a line.

Claude's memory keeps your 15 best notes. RoBrain keeps the 50 things you decided NOT to do — and hands them to every tool, right before they're about to happen again.

Self-hosted, Apache 2.0, four commands to try: [repo link]

(Numbers from my own machine — founder's field note, not a benchmark. The controlled version, VetoBench, is in the repo with receipts.)
─────────────────────────────────────────────────────────────
-->
