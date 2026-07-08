// packages/vetobench/src/adapters.ts
// ─────────────────────────────────────────────────────────────
// The memory conditions under test. Each adapter turns (scenario,
// corpus) into the context block that condition would put in front
// of the agent. Third-party memory systems plug in by implementing
// MemoryAdapter — see the README's "Adding a memory system".
//
// The four built-ins isolate two variables:
//   none        → no memory at all (floor)
//   conventions → choices recorded, vetoes absent (what a typical
//                 CLAUDE.md / conventions file actually contains)
//   flatfile    → everything dumped flat, vetoes included, no
//                 retrieval (a diligent-but-unranked notes file)
//   robrain     → top-k retrieval via the 5-signal composite score,
//                 vetoes rendered as first-class warnings
//
// conventions-vs-flatfile isolates the value of *storing vetoes*;
// flatfile-vs-robrain isolates the value of *retrieval + ranking*
// (which matters more as the corpus outgrows the context window).
// ─────────────────────────────────────────────────────────────

import { cosine, hashEmbedder, type Embedder } from './embedder.js'
import { compositeScore } from './scoring.js'
import type { CorpusDecision, MemoryAdapter, Scenario } from './types.js'

export const RETRIEVAL_K = 5

function renderDecision(d: CorpusDecision, withVetoes: boolean): string {
  const lines = [`- ${d.decision} — ${d.rationale}`]
  if (withVetoes) {
    for (const r of d.rejected) {
      lines.push(`  - REJECTED: ${r.option} — ${r.reason}`)
    }
  }
  return lines.join('\n')
}

export const noneAdapter: MemoryAdapter = {
  name: 'none',
  description: 'No memory context at all.',
  buildContext: () => '',
}

export const conventionsAdapter: MemoryAdapter = {
  name: 'conventions',
  description: 'All recorded choices, no rejected alternatives — what a typical conventions file contains.',
  buildContext: (_scenario, corpus) =>
    `Project conventions and prior decisions:\n${corpus.map(d => renderDecision(d, false)).join('\n')}`,
}

export const flatfileAdapter: MemoryAdapter = {
  name: 'flatfile',
  description: 'Every decision including rejected alternatives, dumped flat with no retrieval or ranking.',
  buildContext: (_scenario, corpus) =>
    `Project decision log:\n${corpus.map(d => renderDecision(d, true)).join('\n')}`,
}

/**
 * RoBrain condition: rank the corpus with the same 5-signal composite
 * scoring Perception uses for GET /decisions?query=…, inject the top-k
 * with rejected[] rendered as explicit warnings — the shape `npx robrain
 * inject` produces.
 */
export function makeRobrainAdapter(embed: Embedder = hashEmbedder, k: number = RETRIEVAL_K): MemoryAdapter {
  return {
    name: 'robrain',
    description: `Top-${k} decisions by 5-signal composite score, rejected alternatives rendered as warnings.`,
    buildContext: (scenario, corpus, asOf) => {
      const queryEmbedding = embed(scenario.task)
      const ranked = corpus
        .map(d => ({
          d,
          score: compositeScore(
            d,
            cosine(queryEmbedding, embed(`${d.decision} ${d.rationale}`)),
            scenario.files_in_scope,
            asOf,
          ),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, k)
        .map(r => r.d)

      return `Relevant prior decisions for this task (from team memory):\n${ranked.map(d => renderDecision(d, true)).join('\n')}`
    },
  }
}

/** Retrieval-layer measurement: rank the corpus and report where the veto decision lands. */
export function vetoRank(
  scenario: Scenario,
  corpus: CorpusDecision[],
  asOf: string,
  embed: Embedder = hashEmbedder,
): number {
  const queryEmbedding = embed(scenario.task)
  const ranked = corpus
    .map(d => ({
      id: d.id,
      score: compositeScore(
        d,
        cosine(queryEmbedding, embed(`${d.decision} ${d.rationale}`)),
        scenario.files_in_scope,
        asOf,
      ),
    }))
    .sort((a, b) => b.score - a.score)

  return ranked.findIndex(r => r.id === scenario.veto_decision_id) + 1   // 1-based; 0 = not found
}

export function builtinAdapters(embed: Embedder = hashEmbedder): MemoryAdapter[] {
  return [noneAdapter, conventionsAdapter, flatfileAdapter, makeRobrainAdapter(embed)]
}
