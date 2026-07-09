#!/usr/bin/env node
// SessionStart hook — inject the always-on project summary (top decisions with
// their rejected alternatives) at the start of every Claude Code session.
// Deterministic replacement for the model remembering to call sensing_start_session.

import {
  readStdin, parseHookInput, loadPerception, resolveProjectId,
  perceptionFetch, emitContext, exitSilently,
} from './lib.mjs'

const input = parseHookInput(await readStdin())
const cwd = input.cwd ?? process.cwd()
const perception = loadPerception()
const projectId = resolveProjectId(cwd)

const summary = await perceptionFetch(`/projects/${projectId}/summary`, perception, {}, 3000)
const text = summary?.summary ?? summary?.always_on_summary
if (!text || typeof text !== 'string' || !text.trim()) exitSilently()

emitContext(
  'SessionStart',
  [
    '## RoBrain project memory (always-on summary)',
    'Prior decisions for this project, including rejected alternatives. Respect the rejections —',
    'if a task invites a previously rejected approach, surface the rejection instead of re-proposing it.',
    '',
    text.trim(),
  ].join('\n'),
)
