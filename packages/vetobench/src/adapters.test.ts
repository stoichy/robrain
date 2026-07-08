// packages/vetobench/src/adapters.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { conventionsAdapter, flatfileAdapter, makeRobrainAdapter, noneAdapter } from './adapters.js'
import type { CorpusDecision, Scenario } from './types.js'

const corpus: CorpusDecision[] = [
  {
    id: 'd1',
    decision: 'Keep the API on Hono',
    rationale: 'lightweight middleware',
    rejected: [{ option: 'Express', reason: 'slower cold starts' }],
    files_affected: ['api/server.ts'],
    created_at: '2026-06-01T00:00:00Z',
    reviewed_at: '2026-06-02T00:00:00Z',
    historical_relevance: 0.8,
  },
  {
    id: 'd2',
    decision: 'Logs are JSON lines',
    rationale: 'ops dashboards parse them',
    rejected: [],
    files_affected: ['api/logger.ts'],
    created_at: '2026-05-01T00:00:00Z',
    reviewed_at: null,
    historical_relevance: 0.4,
  },
]

const scenario: Scenario = {
  id: 's1',
  veto_decision_id: 'd1',
  trap: 'implicit',
  task: 'Modernize the API middleware on the Hono server',
  files_in_scope: ['api/server.ts'],
  rejected_option: 'Express',
  rejected_markers: [],
  accepted_markers: [],
}

const AS_OF = '2026-07-01T00:00:00Z'

test('none provides no context', async () => {
  assert.equal(await noneAdapter.buildContext(scenario, corpus, AS_OF), '')
})

test('conventions includes choices but never vetoes', async () => {
  const ctx = await conventionsAdapter.buildContext(scenario, corpus, AS_OF)
  assert.match(ctx, /Keep the API on Hono/)
  assert.doesNotMatch(ctx, /REJECTED/)
  assert.doesNotMatch(ctx, /Express/)
})

test('flatfile includes vetoes with reasons', async () => {
  const ctx = await flatfileAdapter.buildContext(scenario, corpus, AS_OF)
  assert.match(ctx, /REJECTED: Express — slower cold starts/)
})

test('robrain retrieves the veto decision for a related task', async () => {
  const ctx = await makeRobrainAdapter().buildContext(scenario, corpus, AS_OF)
  assert.match(ctx, /REJECTED: Express/)
})

test('robrain top-k actually truncates', async () => {
  const big: CorpusDecision[] = Array.from({ length: 10 }, (_, i) => ({
    ...corpus[1]!,
    id: `dx${i}`,
    decision: `Unrelated decision number ${i}`,
  }))
  const ctx = await makeRobrainAdapter(undefined, 3).buildContext(scenario, [...big, corpus[0]!], AS_OF)
  const lines = ctx.split('\n').filter((l: string) => l.startsWith('- '))
  assert.equal(lines.length, 3)
})
