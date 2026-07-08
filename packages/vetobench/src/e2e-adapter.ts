// packages/vetobench/src/e2e-adapter.ts
// ─────────────────────────────────────────────────────────────
// robrain-e2e: RoBrain's FULL pipeline as a VetoBench condition.
//
// The plain `robrain` condition reads the fixture corpus with
// rejected[] already structured — it isolates storage + retrieval
// and assumes capture worked. This condition removes that
// assumption: the same session transcripts fed to mem0 (identical
// bytes, via transcripts.ts) are pushed through RoBrain's REAL
// production extractor — extractDecisionLlm from @robrain/shared,
// the exact prompt Sensing and Perception run — and whatever THAT
// produces becomes the corpus. If the extractor drops a veto, the
// loss propagates to retrieval and the agent, same as it would in
// production.
//
// Carried over from the fixtures rather than extracted:
//   files_affected  — production gets these from editor telemetry
//                     (files_touched), not from the LLM
//   created_at      — capture timestamps, not extraction output
//   reviewed_at     — human approval happens after capture
//   historical_relevance — scored later in the pipeline
//
// Rows where the extractor returns decision:null are dropped, as
// Perception would drop them. init() records a per-decision
// extraction report (veto kept / dropped / decision lost) that
// --archive persists — the capture-fidelity receipts.
// ─────────────────────────────────────────────────────────────

import {
  DEFAULT_ANTHROPIC_LLM_MODEL,
  DEFAULT_OPENAI_LLM_MODEL,
  extractDecisionLlm,
  resolveLlmProvider,
} from '@robrain/shared'
import { makeRobrainAdapter, RETRIEVAL_K } from './adapters.js'
import { decisionAsTranscript } from './transcripts.js'
import type { CorpusDecision, MemoryAdapter, Scenario } from './types.js'

interface ExtractionRecord {
  id: string
  extracted_decision: string | null
  extracted_rationale: string | null
  extracted_rejected: Array<{ option: string; reason: string }>
  confidence: number
  vetoes_in_fixture: string[]
  vetoes_kept: string[]
  vetoes_dropped: string[]
}

export function makeRobrainE2eAdapter(k: number = RETRIEVAL_K): MemoryAdapter {
  const inner = makeRobrainAdapter(undefined, k)
  let extractedCorpus: CorpusDecision[] | null = null
  let records: ExtractionRecord[] = []

  return {
    name: 'robrain-e2e',
    description: `RoBrain full pipeline — production extractor over the same transcripts, then top-${k} composite retrieval.`,

    async init(corpus: CorpusDecision[]): Promise<void> {
      const provider = resolveLlmProvider()
      const cfg = {
        provider,
        anthropicApiKey: process.env.ANTHROPIC_API_KEY,
        anthropicModel: process.env.ROBRAIN_EXTRACTION_MODEL ?? DEFAULT_ANTHROPIC_LLM_MODEL,
        openaiApiKey: process.env.OPENAI_API_KEY,
        openaiModel: process.env.ROBRAIN_EXTRACTION_MODEL ?? DEFAULT_OPENAI_LLM_MODEL,
      }

      extractedCorpus = []
      records = []

      for (const d of corpus) {
        const [user, assistant] = decisionAsTranscript(d)
        const extracted = await extractDecisionLlm(user!.content, assistant!.content, cfg)

        const fixtureVetoes = d.rejected.map(r => r.option)
        const keptVetoes = extracted.rejected.map(r => r.option)
        const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
        const kept = fixtureVetoes.filter(f => keptVetoes.some(x => norm(x).includes(norm(f)) || norm(f).includes(norm(x))))

        records.push({
          id: d.id,
          extracted_decision: extracted.decision,
          extracted_rationale: extracted.rationale,
          extracted_rejected: extracted.rejected,
          confidence: extracted.confidence,
          vetoes_in_fixture: fixtureVetoes,
          vetoes_kept: kept,
          vetoes_dropped: fixtureVetoes.filter(f => !kept.includes(f)),
        })

        if (extracted.decision === null) continue   // Perception drops null extractions
        extractedCorpus.push({
          ...d,
          decision: extracted.decision,
          rationale: extracted.rationale ?? '',
          rejected: extracted.rejected,
        })
      }

      const totalVetoes = records.reduce((n, r) => n + r.vetoes_in_fixture.length, 0)
      const dropped = records.reduce((n, r) => n + r.vetoes_dropped.length, 0)
      const lost = records.filter(r => r.extracted_decision === null).length
      console.log(
        `robrain-e2e extraction: ${corpus.length - lost}/${corpus.length} decisions kept, ` +
        `${totalVetoes - dropped}/${totalVetoes} vetoes survived` +
        (dropped ? ` (dropped: ${records.flatMap(r => r.vetoes_dropped).join(', ')})` : ''),
      )
    },

    buildContext(scenario: Scenario, _corpus: CorpusDecision[], asOf: string) {
      if (!extractedCorpus) throw new Error('robrain-e2e: init() must run before buildContext()')
      return inner.buildContext(scenario, extractedCorpus, asOf)
    },

    report: () => ({ extraction: records }),
  }
}
