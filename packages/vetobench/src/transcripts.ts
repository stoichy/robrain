// packages/vetobench/src/transcripts.ts
// ─────────────────────────────────────────────────────────────
// The session-transcript rendering of a corpus decision — the
// SAME prose is fed to every third-party ingestion pipeline
// (mem0) and to RoBrain's own extractor (robrain-e2e), so
// end-to-end conditions compare extraction quality on identical
// input, byte for byte.
// ─────────────────────────────────────────────────────────────

import type { CorpusDecision } from './types.js'

export function decisionAsTranscript(d: CorpusDecision): Array<{ role: string; content: string }> {
  const rejectedProse = d.rejected.length
    ? ` We considered and rejected: ${d.rejected.map(r => `${r.option} — ${r.reason}`).join('; ')}.`
    : ''
  return [
    { role: 'user', content: `What did we settle on for this? (${d.files_affected.join(', ')})` },
    { role: 'assistant', content: `Decision: ${d.decision}. Rationale: ${d.rationale}.${rejectedProse}` },
  ]
}
