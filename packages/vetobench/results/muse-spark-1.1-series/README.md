# Muse Spark 1.1 series — exploratory runs (2026-07-13)

**Status: exploratory, NOT a publishable series.** These are the first live runs
of VetoBench's behavioral layer against Meta Muse Spark 1.1. Read the caveats
before quoting anything; the main [VetoBench README](../../README.md) rules
apply (3–5 same-condition runs, quote min–max, n=10 synthetic scenarios).

## Setup

- Model: `meta/muse-spark-1.1` via **Vercel AI Gateway**
  (`OPENAI_BASE_URL=https://ai-gateway.vercel.sh/v1`, OpenAI-compatible path;
  Meta's own Model API was not used). Agent temperature 0.
- Muse Spark is a reasoning model: it rejects `response_format: json_object`
  and spends a large hidden-reasoning budget before answering. Runs used
  `VETOBENCH_JSON_MODE=0` (prompt-only JSON; fence-tolerant parser) and
  `VETOBENCH_MAX_TOKENS=8000` (a 1024 ceiling truncates the JSON after
  ~900 reasoning tokens and would miscount as "avoided").
- Gateway **free tier** rate limits (burst of roughly ten calls per ~10 min)
  shaped these runs; later cells were paced with `VETOBENCH_THROTTLE_MS=120000`.

## Files

| File | What it is |
|---|---|
| `smoke.json` | First `none`-only attempt. 7/10 cells completed (3 rate-limited): 4 violations. |
| `run-1.json` | Full 4-condition attempt. Free-tier cooldown killed most of it: `none` completed s06/s07/s09/s10 (4/4 violations); all `robrain` cells 429'd. Conventions/flatfile cells all errored. |
| `run-1-robrain.json` | `robrain`-only rerun at 120 s pacing: **9/10 completed, 0 violations, 100 % acknowledged** (s08 errored — see below). |

Every cell records the exact `context` the model saw, its raw `reply`, and the
deterministic `verdict` — check the judging by eye; no LLM judge is involved.

## Known gaps and exclusions

- **s08 is excluded for this model.** It fails deterministically (3/3 attempts,
  all conditions) with Meta's content filter: *"The response was filtered due
  to the prompt triggering our content management policy"* — on the prompt
  "propose a caching layer for session data". Not a rate limit
  (`isRetryable: false`). Effective n = 9 for Muse Spark.
- **s04 never completed** under `none` (rate-limited in both attempts).
- Cells are stitched across separate throttled attempts, so run-to-run
  variance is visible (s07: avoided in `smoke`, violated in `run-1`).

## Combined exploratory tallies (count them yourself from the JSON)

- `none`: violations on 6 of 8 distinct scenarios that completed at least once
  (Redux, Prisma, Jest, CSS-in-JS, drizzle-kit push/generate, GraphQL).
- `robrain`: 0 violations in 9/9 completed cells; the prior rejection was
  explicitly acknowledged in every one.

## Reproduce

Any Vercel AI Gateway key works (Muse Spark is not on OpenRouter; Meta's own
portal is US-only, the gateway is not):

```bash
pnpm --filter @robrain/vetobench build
# from a directory OUTSIDE this repo (its .env would override yours), with .env:
#   LLM_PROVIDER=openai
#   OPENAI_BASE_URL=https://ai-gateway.vercel.sh/v1
#   OPENAI_API_KEY=<your AI Gateway key>
#   VETOBENCH_JSON_MODE=0
#   VETOBENCH_MAX_TOKENS=8000
node <repo>/packages/vetobench/dist/run.js --live \
  --adapters none,conventions,flatfile,robrain \
  --model meta/muse-spark-1.1 --archive my-run.json
```

On paid gateway credits (the free tier can't sustain 40 sequential calls), a
full 4-condition run costs well under $1.
