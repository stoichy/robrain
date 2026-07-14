// packages/cli/src/lib/codex-hooks.ts
// Materialize the RoBrain Codex hook scripts into ~/.robrain/hooks/codex so
// the [hooks] entries robrain install writes into ~/.codex/config.toml
// resolve to stable absolute paths. Same self-containment pattern as the
// vendored sensing-mcp bundle: published tarballs carry the scripts under
// vendor/codex-hooks; monorepo dev resolves them from plugins/.

import { cpSync, existsSync, mkdirSync, rmSync } from 'fs'
import { homedir } from 'os'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

/** Shared with the Claude plugin (single implementation) + the Codex-specific stop. */
const SCRIPTS = ['lib.mjs', 'session-start.mjs', 'user-prompt-submit.mjs', 'stop.mjs'] as const

export const CODEX_HOOKS_DIR = join(homedir(), '.robrain', 'hooks', 'codex')

export function codexHooksComplete(dir: string): boolean {
  return SCRIPTS.every(f => existsSync(join(dir, f)))
}

/**
 * Locate the hook-script source shipped with this CLI.
 * Published tarball: vendor/codex-hooks (flat, pre-assembled by the vendor
 * script). Monorepo dev: assembled from plugins/claude-code/hooks (shared
 * scripts) + plugins/codex/hooks (stop.mjs) — returned as two roots.
 */
export function resolveCodexHookSources(): Array<{ dir: string; files: string[] }> | undefined {
  const here = dirname(fileURLToPath(import.meta.url))   // <cli-root>/dist/lib
  const cliRoot = join(here, '..', '..')

  const vendored = join(cliRoot, 'vendor', 'codex-hooks')
  if (codexHooksComplete(vendored)) return [{ dir: vendored, files: [...SCRIPTS] }]

  const claudeHooks = join(cliRoot, '..', '..', 'plugins', 'claude-code', 'hooks')
  const codexHooks  = join(cliRoot, '..', '..', 'plugins', 'codex', 'hooks')
  const shared = ['lib.mjs', 'session-start.mjs', 'user-prompt-submit.mjs']
  if (shared.every(f => existsSync(join(claudeHooks, f))) && existsSync(join(codexHooks, 'stop.mjs'))) {
    return [
      { dir: claudeHooks, files: shared },
      { dir: codexHooks, files: ['stop.mjs'] },
    ]
  }
  return undefined
}

/**
 * Copy hook scripts from `sources` into `destDir`.
 * Returns the destination when complete, undefined when `sources` is empty or copy fails.
 */
export function materializeCodexHooks(
  sources: Array<{ dir: string; files: string[] }>,
  destDir: string,
): string | undefined {
  if (!sources.length) return undefined

  rmSync(destDir, { recursive: true, force: true })
  mkdirSync(destDir, { recursive: true })
  for (const { dir, files } of sources) {
    for (const f of files) cpSync(join(dir, f), join(destDir, f))
  }
  return codexHooksComplete(destDir) ? destDir : undefined
}

/**
 * Copy the scripts into `destDir` (default ~/.robrain/hooks/codex).
 * Returns the destination when materialized, undefined when no source found.
 */
export function installCodexHooks(destDir: string = CODEX_HOOKS_DIR): string | undefined {
  const sources = resolveCodexHookSources()
  if (!sources) return undefined
  return materializeCodexHooks(sources, destDir)
}
