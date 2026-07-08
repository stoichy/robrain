// packages/vetobench/src/mem0-adapter.ts
// ─────────────────────────────────────────────────────────────
// Mem0 (OSS, in-process) as a VetoBench memory condition.
//
// Fairness contract — what this adapter does and why:
//
//   Ingestion parity. RoBrain's corpus carries structured rejected[]
//   because RoBrain's classifier extracted it from session prose. Mem0
//   gets the SAME information as session-transcript-shaped messages —
//   decision, rationale, and every rejected option with its reason,
//   in plain prose — and its own production pipeline (LLM fact
//   extraction, `infer: true`) decides what becomes memories. We do
//   not pre-structure anything for it, and we do not withhold anything
//   from it.
//
//   Retrieval parity. Same query (the scenario task), same k as the
//   robrain condition, Mem0's own semantic search. Decision dates are
//   NOT passed: mem0ai@3.0.13 OSS throws on the `timestamp` option
//   ("Temporal reasoning requires a Mem0 API key") — time-aware memory
//   is gated to their paid platform, so the OSS tier ingests undated.
//
//   Config. Mem0's documented defaults: OpenAI gpt-4o-mini extraction,
//   text-embedding-3-small, in-process vector store. Override with
//   MEM0_LLM_MODEL / MEM0_EMBEDDING_MODEL. Needs OPENAI_API_KEY.
//
// Mem0's extraction is itself LLM-based, so ingestion is not
// deterministic across runs — report run date and models with any
// number. Dispute the framing? The whole contract is this file; PRs
// welcome.
// ─────────────────────────────────────────────────────────────

import { Memory } from 'mem0ai/oss'
import { RETRIEVAL_K } from './adapters.js'
import { decisionAsTranscript } from './transcripts.js'
import type { CorpusDecision, MemoryAdapter, Scenario } from './types.js'

const USER_ID = 'vetobench-team'

export function makeMem0Adapter(k: number = RETRIEVAL_K): MemoryAdapter {
  let memory: Memory | null = null

  return {
    name: 'mem0',
    description: `Mem0 OSS (infer:true extraction) — top-${k} semantic search over the same decision prose.`,

    async init(corpus: CorpusDecision[]): Promise<void> {
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) throw new Error('mem0 adapter needs OPENAI_API_KEY (Mem0 OSS default LLM + embedder)')

      memory = new Memory({
        embedder: {
          provider: 'openai',
          config: { apiKey, model: process.env.MEM0_EMBEDDING_MODEL ?? 'text-embedding-3-small' },
        },
        llm: {
          provider: 'openai',
          config: { apiKey, model: process.env.MEM0_LLM_MODEL ?? 'gpt-4o-mini' },
        },
        vectorStore: {
          provider: 'memory',
          config: { collectionName: 'vetobench' },
        },
        disableHistory: true,
      })

      for (const d of corpus) {
        await memory.add(decisionAsTranscript(d), { userId: USER_ID })
      }
    },

    async buildContext(scenario: Scenario): Promise<string> {
      if (!memory) throw new Error('mem0 adapter: init() must run before buildContext()')
      const { results } = await memory.search(scenario.task, {
        topK: k,
        filters: { user_id: USER_ID },
      })
      if (results.length === 0) return ''
      return `Relevant memories for this task (from team memory):\n${results.map(m => `- ${m.memory}`).join('\n')}`
    },
  }
}
