#!/usr/bin/env node
// Assemble the Codex hook scripts into vendor/codex-hooks for the published
// tarball: the shared scripts come from the Claude plugin (single source),
// stop.mjs from the Codex plugin. Same pattern as vendor-sensing-mcp.
import { cpSync, existsSync, mkdirSync, rmSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const cliRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const claudeHooks = join(cliRoot, '..', '..', 'plugins', 'claude-code', 'hooks')
const codexHooks  = join(cliRoot, '..', '..', 'plugins', 'codex', 'hooks')
const dest = join(cliRoot, 'vendor', 'codex-hooks')

const wanted = [
  [claudeHooks, 'lib.mjs'],
  [claudeHooks, 'session-start.mjs'],
  [claudeHooks, 'user-prompt-submit.mjs'],
  [codexHooks, 'stop.mjs'],
]

for (const [dir, f] of wanted) {
  if (!existsSync(join(dir, f))) {
    console.error('vendor-codex-hooks: missing', join(dir, f))
    process.exit(1)
  }
}

rmSync(dest, { recursive: true, force: true })
mkdirSync(dest, { recursive: true })
for (const [dir, f] of wanted) cpSync(join(dir, f), join(dest, f))
console.log(`Vendored codex hooks → packages/cli/vendor/codex-hooks`)
