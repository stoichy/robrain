# RoBrain — Agentic Context Management System

**Component Architecture — Living Design Document**

| Version | Date       | Reflects repo state                                    |
|---------|------------|--------------------------------------------------------|
| v1      | 2026-05-08 | `a9f803d` on `main` — Synthesis still "Coming soon"   |
| v2      | 2026-05-08 | Identical content; filename rename                     |
| **v3**  | **2026-05-11** | **OSS Synthesis shipped + F1/F2/F6/F7 status moved**  |

This document captures the evolving architecture of a context management system for Claude Code (and other agents). It is structured in six parts:

- **Part 1** — Inception design (the full theoretical system as originally conceived).
- **Part 2** — Practical solution (the revised build philosophy — build only what is missing).
- **Part 3** — Phase 0 OSS architecture, reflecting what actually ships in v0.2.1+.
- **Part 4** — OSS reality & architecture follow-ups (status of F1–F9).
- **Part 5** — *New in v3.* Synthesis design decisions from the May 2026 build-out thread.
- **Part 6** — *New in v3.* Pending architectural follow-ups (open items).

Conventions in this document:

> 🟢 **[Reality in OSS]** — green callouts note where shipped code matches the spec.
> 🔴 **[Drift from spec]** — red callouts note where shipped code diverges.
> 🟡 **[Follow-up]** — yellow callouts mark architectural follow-ups (open or closed).
> 🆕 **[v3 update]** — items new or substantively changed in this revision.

---

## PART 1 — High-level idea: inception design

*(Preserved from v1/v2. Summary only — see v1 PDF for full inception detail.)*

The system was conceived as five components plus a cross-cutting sharing layer working together to give Claude Code persistent, causally-structured memory across sessions:

| Component   | Role                                                                | Original location          |
|-------------|---------------------------------------------------------------------|----------------------------|
| Sensing     | Observes live sessions; detects new vs. changed information         | With Claude Code (MCP)     |
| Localization| Structural code index; knows what files exist and their shape       | With Claude Code (MCP)     |
| Perception  | Stores decisions, rationale, rejected options, bug history          | External agent             |
| Planning    | Decides what context is relevant; ranks memories by task            | External agent             |
| Control     | Injects context into Claude Code at the right moment                | With Claude Code (MCP)     |
| Sharing     | Cross-cutting: controls scope (user / local / team / global)        | Cross-cutting layer        |

The key design constraints from inception remain load-bearing:

- Control must never cost more context than it saves — every injected token is borrowed from Claude's reasoning budget.
- Sensing must never block the session hot path — all processing is async via a local buffer with a flush-on-close hook.
- Decisions are never hard-deleted; the full causal graph is queryable forever.
- The `rejected[]` array — what was considered and not chosen, with reason — is the structural differentiator versus every other memory product.

---

## PART 2 — Practical solution: build only what is missing

*(Preserved from v1/v2.)*

The revised design philosophy:

| Concern                                | Solved by                                              | RoBrain's role                                              |
|----------------------------------------|--------------------------------------------------------|--------------------------------------------------------------|
| Structural code knowledge (Localization)| Cursor index, GitHub Copilot Memory, LSP, Tree-sitter | Thin adapter layer — query whichever index the dev has       |
| Causal memory storage (Perception)     | pgvector for semantic search; `decision_relations` graph| Write the capture logic that decides what to store and how   |
| Flat fact retrieval (Planning)         | Mem0-style facts + planning_blocks for inferred patterns| Write the relevance scoring that ranks what to surface       |
| Embeddings                             | `text-embedding-3-small` or equivalent                 | Call the API. Do not train.                                  |
| **Session observation (Sensing)**      | **Nobody. This does not exist.**                       | **Build it. Primary genuine gap.**                           |
| **Context injection (Control)**        | **Nobody. This does not exist.**                       | **Build it. Second genuine gap (cloud-only in v0.2.x).**     |
| **Cross-decision intelligence (Synthesis)** | **Nobody.**                                          | **Build it. v3: shipped in OSS as scheduled batch job.**     |

Localization is no longer a bespoke component — it's an adapter interface. Three intended backends: Cursor local index (not built), GitHub Copilot Memory API (not built), session-local files-touched map (shipped — backs topic-shift Stage 2).

---

## PART 3 — Phase 0: OSS architecture (shipped state, v0.2.1+)

🆕 **[v3 update]** This section is substantially rewritten to reflect what ships *after* the Synthesis build-out: `packages/synthesis/`, the versioned migrations runner, the `working_directory` column on `projects`, and the export-memory bridge.

RoBrain ships as Apache 2.0 open source. OSS strategy: open the capture layer (Sensing, schema, CLI), the basic Perception, **and now Synthesis**; protect the intelligence layer (calibrated extraction prompt, full Planning scorer, cloud Control MCP with disengagement + pre-task warnings). The moat is intelligence, not access.

### OSS vs cloud split — actual v0.2.1+

| Component       | OSS (shipped)                                                                                           | Cloud only                                                              | Why split here                                              |
|-----------------|---------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------|-------------------------------------------------------------|
| Sensing MCP     | Full source                                                                                             | —                                                                       | The passive capture differentiator. No value in protecting. |
| Perception API  | Self-hosted (`packages/perception-self-hosted`) — basic Haiku extraction, embeddings, summary regen, /scores feedback | Calibrated extraction prompt; agent ownership map                       | Basic prompt ~80% accuracy; calibrated ~95% is the moat.    |
| DB schema       | Full `packages/shared/schema.sql`                                                                       | —                                                                       | `rejected[]` is the structural differentiator.              |
| CLI             | Full source — `review`, `inject`, `explain`, `export-memory`, `projects`, `init-project`, `install`, `status`, `rule`, `logout`, **`synth`** 🆕 | —                                                                       | Trust layer must be open to be trusted.                     |
| Control MCP     | None. Spec'd OSS Control MCP did not ship in v0.2.x.                                                    | Full Control MCP — auto-inject at task boundaries + disengagement + pre-task rejection warnings | OSS user paths to context flow through CLI inject / export-memory. |
| Planning API    | —                                                                                                       | Full 5-signal weighted scorer (semantic 0.32 + file_overlap 0.27 + recency 0.18 + historical_relevance 0.13 + **approval_state 0.10** 🆕) + Letta-block updates | OSS substitutes recency + file-overlap ordering inside CLI inject. |
| **Synthesis**   | 🆕 **Shipped — `packages/synthesis` + `robrain synth` CLI + `pnpm synthesis:run`. Three-pass batch job (cluster+drift, contradiction scan, entity promotion).** | Cloud roadmap: full auto-resolution + dashboard visualizations.         | Three-pass differentiator; OSS populates planning_blocks and decision_relations on demand. |

> 🟢 **[Reality in OSS v0.2.1+, May 2026]**
> Sensing-MCP, Perception-self-hosted, shared schema, ten CLI commands, **and Synthesis** all ship. The four-edge `decision_relations` table is **now populated** by OSS Synthesis Pass 2 (`conflicts_with`, `related_to`, `extends`). `planning_blocks` is **now populated** by OSS Synthesis (`compiled_truth`, `drift_signal`, `entity` block types).

### Shipped surfaces

**Sensing MCP tools (OSS, all four)** — `sensing_start_session`, `sensing_record_turn`, `sensing_end_session`, `sensing_get_status`. (Unchanged from v2.)

**Perception HTTP endpoints (OSS):**

| Method + path                            | Purpose                                                                                            |
|------------------------------------------|----------------------------------------------------------------------------------------------------|
| `GET /health`                            | Liveness — returns `{ status: 'ok', db: 'connected', mode: 'oss-self-hosted' }`.                    |
| `POST /signals`                          | Ingest from Sensing. Confidence-gates, runs Haiku extraction, embeds, writes.                       |
| `GET /decisions`                         | Backs `robrain review`, `robrain inject`, `robrain explain`. Filters: `session_id`, `all`, `history`, `limit`. 🆕 Now returns `conflict_counterpart_id` derived from `decision_relations`. |
| `POST /scores`                           | Reply-scorer feedback from Sensing. Updates `historical_relevance`.                                 |
| `POST /corrections`                      | User corrections from `robrain review`. 🆕 Accepts `counterpart_id` and writes `related_to` edge when user "keeps both" in a conflict. |
| `POST /projects` · `GET /projects` · `POST /projects/merge` | Project lifecycle. 🆕 `working_directory` accepted on POST, surfaced on GET, COALESCEd on merge. |
| `GET /projects/:id/summary`              | Always-on summary fetched by `sensing_start_session`.                                              |
| `POST /projects/:id/regenerate-summary`  | Trigger veto-preserving Haiku summary regeneration; debounced 30 s.                                |

**CLI commands (OSS, v0.2.1+):**

| Command                                                | What it does                                                                                       |
|--------------------------------------------------------|----------------------------------------------------------------------------------------------------|
| `robrain install --self-hosted`                        | Wire Sensing MCP into editor; chains `init-project` by default.                                    |
| `robrain init-project` (alias `init`)                  | Warm-start Perception with 3–5 inferred decisions. 🆕 Records `working_directory` for the project.  |
| `robrain review [--all] [--history] [--approve-all] [--session id] [--limit n]` | Per-decision Approve / Edit / Reject; default feed shows only unreviewed active decisions. 🆕 When resolving a conflict with "keep both", passes `counterpart_id` so Pass 2 won't re-flag the pair. |
| `robrain inject [--query] [--files] [--copy] [--limit] [--all]` | Veto-preserving format for manual paste into Claude Code.                                  |
| `robrain explain <file> [--why] [--copy]`              | "Why does this code exist?" — semantic + file-overlap query.                                      |
| `robrain export-memory [--dry-run] [--include-unreviewed] [--to dir]` | Project approved decisions into Claude Code Auto Memory directory. 🆕 Now spawned by Synthesis when `SYNTHESIS_EXPORT_MEMORY=true` and a project produced new `compiled_truth`. |
| `robrain projects list / merge <from> <to>`            | Recover phantom project ids; merge sessions/decisions across project rows.                         |
| `robrain rule --add / --list / --remove`               | Manage explicit Planning rules (`always_include` / `always_exclude` / `preference`).               |
| `robrain status` · `robrain logout`                    | Health/diagnostics + clear local credentials.                                                       |
| 🆕 **`robrain synth [--dry-run] [--full] [--lookback <days>] [--project <id>]`** | Run the Synthesis batch job from the robrain clone. Spawns `pnpm --filter @robrain/synthesis start` with the right env vars. |

**Docker / self-hosted services:**

| Service    | Image / build                              | Port | Notes                                                                                      |
|------------|--------------------------------------------|------|--------------------------------------------------------------------------------------------|
| postgres   | `pgvector/pgvector:pg16`                   | 5432 | Volume `robrain_postgres_data`; `schema.sql` applied on first boot.                        |
| perception | Built from `docker/Dockerfile.perception`  | 3001 | `OSS_MODE=true` hardcoded. Reads `.env` at repo root. 🆕 Runs `applySqlMigrations()` on boot from `migrations/NNN_*.sql`. |

Synthesis is **not** a long-running service — it's a Node CLI invoked on demand (`robrain synth`) or by cron (`pnpm synthesis:run`). It reads `DATABASE_URL` directly.

### Decision lifecycle — invalidation, not deletion

Decisions are never hard-deleted. When a decision changes, the old row is marked `invalidated_at = now()` and linked to the new one via `supersedes_id`. The full chain of architectural evolution is always queryable.

The OSS `decision_relations` table currently supports **four typed edges**: `supersedes | extends | conflicts_with | related_to`. 🆕 As of v3, **three of the four are now populated by OSS Synthesis Pass 2** (extends, conflicts_with, related_to). `supersedes` is set only by manual user action in `robrain review`. The originally-spec'd `depends_on` and `refines` edges remain deferred to the cloud Synthesis layer.

---

## PART 4 — OSS reality & architecture follow-ups (status as of v3)

This section catalogues the deltas surfaced by shipping the OSS package and proposes architectural changes the original spec did not anticipate. **All F1–F9 follow-ups have status updates in v3.**

### Spec-doc corrections (apply to the document itself)

These match v2 — the eight spec-doc corrections (Control MCP not shipped; Synthesis was "Coming soon"; six `control_*` tools redirected; four-edge `decision_relations`; reply-scoring wording; full decision schema field list; cold-start replaced by `robrain init-project`; Localization shipped as single backend). 🆕 Item #2 ("Synthesis — Coming soon") **is now obsolete**: Synthesis ships in OSS as of v0.2.1+.

### Architectural follow-ups — status updates

> 🟡 **[F1 — Approval becomes a first-class signal]** · **Status: partial (primitive shipped, OSS consumer pending)**
>
> **Action prescribed in v1/v2:** add a fifth signal (`approval_state ∈ {unreviewed, approved, edited, rejected}`) to the Planning weight model alongside `historical_relevance`.
>
> 🆕 **v3 status:** `SCORING_WEIGHTS.APPROVAL_STATE = 0.10` added to [packages/shared/src/types.ts](../packages/shared/src/types.ts); other four signals rebalanced to keep sum = 1.0 (semantic 0.35 → 0.32; file_overlap 0.30 → 0.27; recency 0.20 → 0.18; historical_relevance 0.15 → 0.13). **The constant is defined but no OSS code path consumes it yet.** Cloud Planning is the intended consumer. Remaining work: wire `approval_state` into `robrain inject` ordering (currently relies on Perception's similarity/recency order with no client-side rescore).

> 🟡 **[F2 — Bridge to Claude Auto Memory is a new injection path]** · **Status: done**
>
> **Action prescribed:** document `robrain export-memory` as a third injection channel alongside (a) cloud Control auto-inject and (b) CLI manual paste; decide whether to schedule periodic re-exports.
>
> 🆕 **v3 status:** export-memory is now the **third injection channel** with a documented refresh trigger: Synthesis spawns `robrain export-memory --cwd <working_directory> --project-id <id>` when `SYNTHESIS_EXPORT_MEMORY=true` AND `wroteCompiled = true` for that project (see [synthesis/src/index.ts:551](../packages/synthesis/src/index.ts:551)). Requires `projects.working_directory` to be recorded (populated by `init-project`).

> 🟡 **[F3 — Project ID stability]** · **Status: not addressed**
>
> Project ID is still derived from a hash of the working directory path. Does not survive `mv` / `cp -r` / nested clones. Remediation (hash `git config --get remote.origin.url` normalised; `.robrain/project.json` UUID fallback for non-git repos; content-fingerprint merge in `robrain projects merge`) remains a follow-up.

> 🟡 **[F4 — OSS schema scaffolding for cloud-only features]** · **Status: partially resolved**
>
> 🆕 **v3 status:** `planning_blocks` is **no longer** OSS-empty scaffolding — Synthesis populates three block types (`compiled_truth`, `drift_signal`, `entity`). The schema comment block at [packages/shared/schema.sql:152](../packages/shared/schema.sql:152) has been updated to reflect this. `mem0_facts` remains OSS-empty (populated only via `robrain rule --add`).

> 🟡 **[F5 — Contradiction detection has schema but no logic in OSS]** · **Status: over-resolved (strategic question open)**
>
> **Original action prescribed:** ship a *cheap* OSS contradiction detector — cosine sim > 0.82 + file overlap → set `conflict_flag`, surface in `robrain review`. Cloud retains the **calibrated reversal / extension / ambiguous Haiku classifier**.
>
> 🆕 **v3 status:** OSS Synthesis Pass 2 ships a **Haiku-judge** 4-way classifier (yes/no/related/extends). This is **stronger than the doc prescribed for OSS** and partially collapses an intended cloud differentiator.
>
> **Open strategic decision (Part 6):** keep Haiku judge in OSS (current ship — easier user value) **or** roll OSS back to SQL-only cosine+file-overlap and reserve the LLM judge for cloud. If keeping OSS Haiku, the cloud differentiator must be stronger: a calibrated 4-way classifier from the page-12 contradiction-handling table — `direct_reversal` / `partial_update` / `ambiguous` / `extends` with few-shot calibration.

> 🟡 **[F6 — Synthesis is the load-bearing differentiator vs Auto Memory]** · **Status: done**
>
> 🆕 **v3 status:** OSS Synthesis shipped as `packages/synthesis` — the headline architectural gap is closed. Implementation deviates from v2's "ship Pass 1 only" prescription: all three passes ship simultaneously. Justified by the F9 hybrid gate (Pass 1 compiled_truth is review-restricted, so it's safe to run from day 1) and the cleanliness of the schema-already-supports-it argument for Passes 2 + 3. README's "memory that compounds on its own" claim is no longer aspirational.

> 🟡 **[F7 — Operational architecture: stale Docker image / migration drift]** · **Status: done**
>
> **Action prescribed:** introduce a `migrations/NNN_*.sql` directory, run on Perception boot in lexical order, with a `schema_migrations` tracking table.
>
> 🆕 **v3 status:** Implemented in [packages/perception-self-hosted/migrations/001_oss_additive_columns.sql](../packages/perception-self-hosted/migrations/001_oss_additive_columns.sql) + [packages/perception-self-hosted/src/migrate.ts](../packages/perception-self-hosted/src/migrate.ts). Filename convention: `NNN_description.sql`. Tracking table: `schema_migrations(version INTEGER PRIMARY KEY, name TEXT, applied_at TIMESTAMPTZ)`. `$SCHEMA` placeholder substitution at apply time. Old in-Perception `runMigrations()` function deleted; `applySqlMigrations(pool, S)` is the only boot entry. Future schema changes ship as new migration files in PRs, not conditional ALTERs in `index.ts`.

> 🟡 **[F8 — Cross-tool support weaker than README implies]** · **Status: not addressed**
>
> Cursor still needs manual `.cursorrules` wiring; no Copilot adapter. Localization "adapter" is still a single backend (session-local file map). Either soften the README claim or commit to the Cursor index reader as the first new Localization backend.

> 🟡 **[F9 — User-curated memory should be a first-class flow]** · **Status: partial (Pass 1 only)**
>
> **Action prescribed:** document `WHERE invalidated_at IS NULL AND reviewed_at IS NOT NULL` as the canonical injection-eligibility rule for both OSS export and cloud Control. Update Trust Layer and Disengagement protocol accordingly.
>
> 🆕 **v3 status:** **Partially implemented in Synthesis only**, as a hybrid: Pass 1 clusters drift across all active decisions, but `compiled_truth` writes are restricted to clusters with at least one `reviewed_at != null` decision (see [synthesis/src/index.ts:197](../packages/synthesis/src/index.ts:197)). The **canonical injection-eligibility rule** is **not yet propagated** to (a) `robrain export-memory`, (b) `robrain inject`, or (c) the cloud Disengagement protocol. Remaining work in Part 6.

---

## PART 5 — Synthesis design decisions (May 2026 thread) 🆕

This part is new in v3. It records the architectural decisions made during the Synthesis build-out, with the *why* preserved so future work can judge edge cases without re-deriving them.

### 5.1 — Package layout and invocation model

**Decision:** Synthesis ships as a standalone Node CLI at `packages/synthesis/`, invoked via `pnpm synthesis:run` (or `pnpm synthesis:dry-run`) or via `robrain synth`. Not a long-running daemon.

**Why:** Zero new infrastructure for OSS users (cron + DATABASE_URL is enough). Scaling is per-batch, not per-request — there's no reason to pay for an always-on process. Reversible if cloud later needs streaming Synthesis: the same passes can be lifted into a service.

**How to apply:** Future Synthesis features (auto-propagated vetoes, supersession proposals — see Part 6) should slot in as additional passes inside the existing main loop, not new services.

### 5.2 — Three-pass design

**Decision:** Synthesis runs three passes per project per invocation:

1. **Pass 1 — Cluster + drift detection.** Group decisions into topic areas via Haiku; flag clusters where recent decisions disagree with earlier consensus. Write a "compiled truth" planning block per topic (veto-preserving format: `"Chose X over Y (reason) over Z (reason)"`).
2. **Pass 2 — Corpus contradiction scan.** Find high-similarity pairs (cosine ≥ `THRESHOLDS.SIMILARITY_LINK`, same scope, not already in `decision_relations`) and ask Haiku a 4-way question: *yes (contradict) / no / related / extends*. Write to `decision_relations` and set `conflict_flag` for confirmed contradictions.
3. **Pass 3 — Entity promotion.** Ask Haiku to extract proper-noun entities (libraries, services, modules); count occurrences **deterministically** (regex over the corpus, not LLM-estimated); promote entities with ≥ 3 mentions into `planning_blocks` with a per-entity summary.

**Why three passes, not one:** Each pass operates at a different abstraction layer (topic, pair, entity). Bundling would produce a tangled prompt; keeping them separate makes each tunable and each retry-able.

**Why this order:** Pass 1 needs the full corpus to cluster well. Pass 2 benefits from Pass 1's clusters being in the database (entity context for the "do these contradict?" prompt). Pass 3 is independent — it could run first or last.

### 5.3 — F9 hybrid gating (compiled_truth review-restriction)

**Decision:** Pass 1 clusters and drift-detects across **all active decisions**, but `compiled_truth` block writes are restricted to clusters that contain **at least one `reviewed_at != null` decision**.

**Why:** Drift detection needs unreviewed decisions visible to see emerging direction change ("we're trending toward Jotai even though Zustand is still the official call"). Compiled truth, on the other hand, is consumed by injection paths — it must be **trustworthy**, which means review-gated. The full F9 canonical rule (`invalidated_at IS NULL AND reviewed_at IS NOT NULL` everywhere) remains a Part 6 follow-up.

**How to apply:** Any new Synthesis pass that writes a planning_block consumed by injection should default to review-restricted; passes that write metadata only (e.g. `conflict_flag`) can use the unreviewed set.

### 5.4 — Pass 2 4-way classifier with `extends` edge

**Decision:** Pass 2's Haiku prompt asks a 4-way question — `yes` (contradicts), `no`, `related`, `extends` — and writes the appropriate `decision_relations` edge per answer.

| Haiku answer | Action                                                        |
|--------------|---------------------------------------------------------------|
| `yes`        | Set `conflict_flag = true` on both; write `conflicts_with`    |
| `extends`    | Write `extends` edge (B → A, where B is the later decision)  |
| `related`    | Write `related_to` edge                                       |
| `no`         | No write                                                      |

**Why 4-way (not 3-way):** The original architecture doc (page 12) framed contradiction-handling as a 3-way taxonomy: direct reversal / partial update / ambiguous conflict. None of those described the case where decision B *builds on* A without contradicting — yet the schema's four-edge support already included `extends`. The 4-way classifier closes the gap.

**Cloud differentiation note:** Cloud's calibrated classifier should preserve the page-12 taxonomy (direct reversal / partial update / ambiguous) on top of the 4-way OSS shape — i.e. cloud classifies *how* something contradicts, OSS classifies *whether* it contradicts.

### 5.5 — Prompt caching policy

**Decision:** All three Pass system prompts are wrapped in `cachedEphemeral()` ([synthesis/src/index.ts:72](../packages/synthesis/src/index.ts:72)) — Anthropic ephemeral cache control with `type: 'ephemeral'`.

**Why:** System prompts are byte-identical across runs and across projects. The Anthropic 5-minute ephemeral cache amortizes the system-prompt tokens across every Haiku call in a Synthesis run (typically dozens). Required SDK bump from `@anthropic-ai/sdk@^0.24.0` to `^0.32.1`.

**How to apply:** Any new pass that uses identical-across-runs system prompts must use `cachedEphemeral()`. Variable prompts (per-decision content) should not be wrapped.

### 5.6 — `projects.working_directory` column

**Decision:** Added `working_directory TEXT` to `context_system.projects` ([migrations/001:21](../packages/perception-self-hosted/migrations/001_oss_additive_columns.sql:21)). CLI populates it from `cwd()` during `init-project`. Perception's `POST /projects` accepts and persists it. `GET /projects` surfaces it. `POST /projects/merge` COALESCEs.

**Why:** Synthesis can't trigger `robrain export-memory` for a project without knowing the absolute path of the project root on disk. Recording it once at `init-project` time is the smallest-blast-radius solution. Falls back gracefully — Synthesis warns and skips export-memory if a project has no `working_directory` recorded.

### 5.7 — Versioned migrations runner (F7 implementation)

**Decision:** `packages/perception-self-hosted/migrations/NNN_*.sql` directory + `applySqlMigrations()` runner ([src/migrate.ts](../packages/perception-self-hosted/src/migrate.ts)) replace the in-Perception `runMigrations()` function.

**Why:** Conditional ALTERs in `index.ts` couple schema changes to code changes, making "pull new code without rebuilding the container" silently dangerous. Versioned files + a `schema_migrations` tracking table make migrations explicit, reviewable, and rollback-able. `$SCHEMA` placeholder substitution lets the same file work for non-default schema names.

**How to apply:** Any future schema change ships as a new `NNN_description.sql` file. No more conditional ALTERs in TypeScript.

### 5.8 — `conflict_counterpart_id` derivation at read time

**Decision:** [Perception GET /decisions](../packages/perception-self-hosted/src/index.ts:282) returns a `conflict_counterpart_id` field derived from `decision_relations` via subquery: for each decision, find the most-recent `conflicts_with` edge that touches it and return the other side's id.

**Why:** When `robrain review` resolves a conflict with "keep both", it needs to tell Perception the *counterpart* so a `related_to` edge can be written and Pass 2 won't re-flag the pair on the next Synthesis run. Computing the counterpart server-side at read time avoids requiring the CLI to walk the graph.

**How to apply:** Any new review-time conflict-resolution flow can read `conflict_counterpart_id` directly from `GET /decisions` instead of doing its own `decision_relations` lookup.

---

## PART 6 — Pending architectural follow-ups (open items as of v3) 🆕

These are open items the v3 thread surfaced but did not implement. Listed in roughly the order they should be tackled to compound RoBrain's `rejected[]` moat.

> 🟡 **[F10 — Auto-propagated vetoes on supersession]** · **Priority: highest**
>
> **What.** When decision A supersedes decision B (`A.supersedes_id = B.id`), automatically append B's chosen option into A's `rejected[]` with B's rationale as the veto reason. Lives in Perception's `/corrections` handler when `invalidate=true` and a `supersedes_with` field is supplied. ~15 lines.
>
> **Why this is the killer feature.** Six months into a project, the newest decision on any topic will carry the full history of failed alternatives — without anyone curating it. mem0 / Zep / Letta can't replicate this because they don't model `rejected[]`. This is the load-bearing realisation of the v1 amendment's "veto preservation" principle, extended from the always-on summary to every individual decision row.
>
> **Status:** Not implemented. Documented in this thread under §3.1.

> 🟡 **[F11 — Supersession proposals from Synthesis (Pass 2b)]** · **Priority: high**
>
> **What.** When Pass 2 confirms two decisions contradict, deterministically pick a winner (newer + higher confidence + same scope, or whichever side's option appears in the other's `rejected[]`) and either:
> - **Auto-apply** if winner's confidence > `THRESHOLDS.DECISION_CONFIDENCE_HIGH` (0.9) → set `supersedes_id`, `auto_resolved = true`, `invalidated_at = now()` on loser; write `supersedes` edge.
> - **Otherwise** → leave `conflict_flag` set for `robrain review` to resolve manually.
>
> **Why.** The page-12 contradiction-handling table prescribes exactly this for the "ambiguous conflict" row: *"Auto-resolve after 2 sessions if no response — newer wins."* Today Pass 2 stops at flagging. Most users won't review — the conflict graph grows but never shrinks.
>
> **Composes with F10:** when F11 sets `supersedes_id`, F10 propagates the veto automatically.

> 🟡 **[F12 — Hypothetical-mode dry-run endpoint (Prediction layer)]** · **Priority: high**
>
> **What.** `POST /synthesis/dry-run` on Perception. Input: a proposed decision text + project_id + scope. Output: which existing decisions it would conflict with, dedup against, or relate to — *before* it's written. Returns top 5 similarity matches partitioned by `DEDUP_SIMILARITY` and `SIMILARITY_LINK` thresholds. ~20 lines.
>
> **Why this is structurally load-bearing.** The autonomy-stack analogy (page 19) marks the Prediction layer as *"Missing entirely → AV systems predict before acting. Pre-load vetoes before Claude re-suggests rejected alternatives."* F12 is literally that component. Nothing else in the architecture asks "what if?" before writing.
>
> **CLI surface:** `robrain check "decision text"` answers "this would conflict with the Bun decision from 2026-05-05".

> 🟡 **[F13 — Decision lineage endpoint]** · **Priority: medium**
>
> **What.** `GET /decisions/:id/lineage` returns the full graph touching a decision — recursive CTE over `supersedes_id` chain + flat query over `decision_relations` edges. ~15 lines.
>
> **Why.** Once F10 + F11 are running, the graph fills with edges that nothing currently exposes. F13 is the read API that powers a future dashboard, also useful for `robrain explain --lineage`. Required for any UI that wants to show "this decision was reached after rejecting X, which had earlier rejected Y, which had earlier rejected Z."

> 🟡 **[F14 — F1 OSS consumer wiring]** · **Priority: medium**
>
> **What.** Apply `SCORING_WEIGHTS.APPROVAL_STATE` in OSS retrieval. Either:
> - Server-side: rescore in `GET /decisions` with `+0.10 * (reviewed_at ? 1 : 0)` applied to similarity. Affects all callers consistently.
> - Client-side: `robrain inject` rescores returned decisions before truncating to `--limit`.
>
> **Recommendation:** server-side, so cloud Control and OSS inject share one behavior.

> 🟡 **[F15 — F9 canonical eligibility rule propagation]** · **Priority: medium**
>
> **What.** Document `WHERE invalidated_at IS NULL AND reviewed_at IS NOT NULL` as the canonical injection-eligibility rule across:
> - `robrain export-memory` (already enforces this — codify it)
> - `robrain inject` (currently ignores `reviewed_at`)
> - cloud Control auto-inject (cloud-only, document as requirement)
> - cloud Disengagement protocol (a captured-but-unreviewed decision should always disengage)

> 🟡 **[F16 — Phase 2 staleness via git-diff signal]** · **Priority: medium**
>
> **What.** Decay `historical_relevance` based on whether `files_affected` have been significantly rewritten since `created_at`, not on time alone. Localization adapter watches git diffs after each session.
>
> **Why.** The original spec (page 15) calls out: *"a decision about cart.ts becomes stale when cart.ts is significantly rewritten — but nothing currently detects that."* Time-only decay (the easy implementation) gets the direction right but the precision wrong — a decision touched by a major rewrite yesterday is more stale than an untouched one from six months ago.
>
> **Where it lives.** A new Synthesis Pass 4, or a per-session hook in Sensing that computes overlap between `files_affected` and `git diff --name-only HEAD~1 HEAD`.

> 🟡 **[F17 — Strategic question: keep Pass 2 Haiku judge in OSS?]** · **Priority: design decision needed**
>
> **What's at stake.** Today OSS Pass 2 uses a Haiku 4-way classifier; the original v1/v2 doc reserved that for cloud and prescribed a *cheap* OSS detector (cosine + file overlap, no LLM).
>
> **Two options:**
> - **Keep current ship:** OSS Pass 2 stays as-is; cloud differentiator becomes a *more-calibrated* 4-way classifier with the page-12 taxonomy (direct reversal / partial update / ambiguous / extends) and few-shot examples.
> - **Roll back OSS to SQL-only:** OSS Pass 2 becomes cosine ≥ 0.82 + file overlap → set `conflict_flag` (no Haiku call). Cloud retains the LLM judge as the differentiator.
>
> **No strong recommendation** — depends on cloud's pricing/value-prop. If cloud is selling "smarter contradiction detection" specifically, roll back. If cloud's value is auto-injection + dashboard + multi-agent, keep the OSS Haiku judge.

> 🟡 **[F18 — Multi-agent contradiction resolution]** · **Priority: low (Phase 3)**
>
> Adding an `agent_id` field + ownership map to handle parallel-agent disagreement. From v1 Phase-2 considerations (page 15). Relevant only once multi-agent workflows are common.

> 🟡 **[F19 — Procedural memory capture]** · **Priority: low (Phase 2)**
>
> `mem0_facts` schema already supports `fact_type='procedure'` (page 15) but no capture path exists. Synthesis Pass 3 could be extended to detect recurring procedural patterns ("when I say refactor, I mean extract functions"). Today Pass 3 only extracts proper-noun entities.

---

## Summary of changes vs v2

This document keeps Parts 1 and 2 essentially intact (inception + practical philosophy don't change). Part 3 was substantively rewritten to reflect what ships in v0.2.1+ (Synthesis package + CLI + endpoints, `working_directory` column, versioned migrations runner). Part 4's nine architectural follow-ups all got status updates — three moved to **done** (F2, F6, F7), two moved to **partial** (F1, F9), one moved to **over-resolved** with a strategic question (F5), one moved to **partially resolved** (F4), two remain **not addressed** (F3, F8). Parts 5 and 6 are new — Part 5 records the architectural decisions made during the Synthesis build-out; Part 6 catalogues ten new open items (F10–F19), four of which compose into a chain (F10 + F11 + F12 + F13) that turns `rejected[]` from a static field into an active prediction system.

The most consequential additions in v3 are **F6 closed** (Synthesis is no longer aspirational), **F10–F13 as the next compounding-moat work** (auto-propagated vetoes + supersession proposals + dry-run + lineage), and the **F17 strategic question** about whether OSS Pass 2 should keep its Haiku judge or roll back to SQL-only to protect the cloud differentiator.

---

**Document status:** Parts 1 & 2 preserved · Part 3 rewritten to reflect v0.2.1+ · Part 4 status-updated · Parts 5 & 6 new · Last updated: 2026-05-11 · Source: github.com/roryplans/robrain @ main.
