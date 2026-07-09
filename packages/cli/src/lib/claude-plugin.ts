// src/lib/claude-plugin.ts
// ─────────────────────────────────────────────────────────────
// Recommend the RoBrain Claude Code plugin to the whole team via the
// project's .claude/settings.json. When a teammate trusts the repo,
// Claude Code itself prompts them to install the plugin — one developer
// running init-project makes the plugin discoverable to everyone else.
// ─────────────────────────────────────────────────────────────

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'

const MARKETPLACE_KEY = 'robrain'
const PLUGIN_ID = 'robrain@robrain'
const GITHUB_SOURCE = { source: 'github', repo: 'adelinamart/robrain' }

export interface PluginRecommendationResult {
  content: string
  changed: boolean
}

/**
 * Merge the RoBrain marketplace + plugin recommendation into existing
 * .claude/settings.json content. Preserves every other key; idempotent.
 * A user's own marketplace entry under the same name (e.g. a local-path
 * source from development) is left untouched.
 */
export function mergePluginRecommendation(existing: string | null): PluginRecommendationResult {
  let settings: Record<string, unknown> = {}
  if (existing !== null && existing.trim()) {
    try {
      const parsed = JSON.parse(existing)
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        // settings.json is not an object — do not guess, leave the file alone
        return { content: existing, changed: false }
      }
      settings = parsed as Record<string, unknown>
    } catch {
      // Unparseable settings.json — never clobber a file we cannot read
      return { content: existing, changed: false }
    }
  }

  const marketplaces = isRecord(settings.extraKnownMarketplaces)
    ? settings.extraKnownMarketplaces
    : {}
  const plugins = isRecord(settings.enabledPlugins)
    ? settings.enabledPlugins
    : {}

  let changed = false
  if (!(MARKETPLACE_KEY in marketplaces)) {
    marketplaces[MARKETPLACE_KEY] = { source: GITHUB_SOURCE }
    changed = true
  }
  if (plugins[PLUGIN_ID] !== true) {
    plugins[PLUGIN_ID] = true
    changed = true
  }
  if (!changed) return { content: existing ?? '', changed: false }

  settings.extraKnownMarketplaces = marketplaces
  settings.enabledPlugins = plugins
  return { content: JSON.stringify(settings, null, 2) + '\n', changed: true }
}

/**
 * Apply the recommendation to <projectRoot>/.claude/settings.json.
 * Returns 'written' | 'already-present' | 'skipped-unreadable'.
 */
export function recommendClaudePlugin(projectRoot: string): 'written' | 'already-present' | 'skipped-unreadable' {
  const settingsPath = join(projectRoot, '.claude', 'settings.json')
  const existing = existsSync(settingsPath) ? readFileSync(settingsPath, 'utf8') : null

  const { content, changed } = mergePluginRecommendation(existing)
  if (!changed) {
    return existing !== null && !isMerged(existing) ? 'skipped-unreadable' : 'already-present'
  }

  mkdirSync(dirname(settingsPath), { recursive: true })
  writeFileSync(settingsPath, content)
  return 'written'
}

function isMerged(content: string): boolean {
  try {
    const s = JSON.parse(content)
    return isRecord(s?.extraKnownMarketplaces) && MARKETPLACE_KEY in s.extraKnownMarketplaces
  } catch {
    return false
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}
