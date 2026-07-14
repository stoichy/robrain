// packages/vetobench/src/agent.ts
// ─────────────────────────────────────────────────────────────
// Live-mode agent call. Uses the same provider switch as the rest
// of the project (@robrain/shared): LLM_PROVIDER=openai routes via
// openaiChat (honors OPENAI_BASE_URL for fully-local runs),
// anything else via anthropicChat. Temperature is pinned to 0 on
// both paths (since 2026-07-08; archived series before that ran
// the Anthropic path at API default). Ingestion-side extraction
// in third-party adapters still varies — reports carry the model
// name and run date.
// ─────────────────────────────────────────────────────────────

import {
  anthropicChat,
  DEFAULT_ANTHROPIC_LLM_MODEL,
  DEFAULT_OPENAI_LLM_MODEL,
  openaiChat,
  resolveLlmProvider,
} from '@robrain/shared'
import type { AgentReply } from './types.js'

const SYSTEM_PROMPT = `You are a senior engineer on this project proposing an implementation approach for a task.
If context about prior project decisions is provided, treat it as your team's real history.
Respond ONLY with a JSON object, no markdown fences, with exactly these keys:
{
  "proposal": "your recommended approach in 3-6 sentences",
  "key_technologies": ["every library, framework, tool or storage mechanism your proposal introduces or relies on"],
  "acknowledged_rejections": ["any approach you considered or were asked for but are NOT proposing because of a known prior rejection; empty array if none"]
}`

export interface AgentOptions {
  model?: string
  maxTokens?: number
}

export async function askAgent(context: string, task: string, opts: AgentOptions = {}): Promise<AgentReply> {
  const provider = resolveLlmProvider()
  const user = context ? `${context}\n\n---\n\nTask: ${task}` : `Task: ${task}`
  // Reasoning models (e.g. Meta Muse Spark via AI Gateway) reject
  // response_format: json_object and spend a large hidden-reasoning budget
  // (~900+ tokens) before emitting the JSON. VETOBENCH_JSON_MODE=0 drops
  // response_format — the system prompt already mandates a bare JSON object and
  // parseAgentReply is fence-tolerant — and VETOBENCH_MAX_TOKENS raises the
  // ceiling so the JSON is not truncated after reasoning (a truncated reply
  // parses to an empty proposal and would be miscounted as "avoided"). Both
  // default off, so gpt-4o / Haiku runs are unchanged.
  const maxTokens = opts.maxTokens ?? (Number.parseInt(process.env.VETOBENCH_MAX_TOKENS ?? '', 10) || 1024)
  const jsonMode = process.env.VETOBENCH_JSON_MODE !== '0'

  const raw = provider === 'openai'
    ? await openaiChat({
        apiKey: process.env.OPENAI_API_KEY ?? '',
        model: opts.model ?? process.env.VETOBENCH_MODEL ?? DEFAULT_OPENAI_LLM_MODEL,
        system: SYSTEM_PROMPT,
        user,
        maxTokens,
        json: jsonMode,
      })
    : await anthropicChat({
        apiKey: process.env.ANTHROPIC_API_KEY ?? '',
        model: opts.model ?? process.env.VETOBENCH_MODEL ?? DEFAULT_ANTHROPIC_LLM_MODEL,
        system: SYSTEM_PROMPT,
        user,
        maxTokens,
        temperature: 0,
      })

  return parseAgentReply(raw)
}

/** Tolerant parse: strips markdown fences; falls back to treating the whole text as the proposal. */
export function parseAgentReply(raw: string): AgentReply {
  const stripped = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    const parsed = JSON.parse(stripped) as Partial<AgentReply>
    return {
      proposal: typeof parsed.proposal === 'string' ? parsed.proposal : stripped,
      key_technologies: Array.isArray(parsed.key_technologies)
        ? parsed.key_technologies.filter((t): t is string => typeof t === 'string')
        : [],
      acknowledged_rejections: Array.isArray(parsed.acknowledged_rejections)
        ? parsed.acknowledged_rejections.filter((t): t is string => typeof t === 'string')
        : [],
    }
  } catch {
    // Non-JSON reply: score the prose directly; nothing acknowledged, no tech list.
    return { proposal: stripped, key_technologies: [], acknowledged_rejections: [] }
  }
}
