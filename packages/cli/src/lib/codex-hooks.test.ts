import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { codexHooksComplete, installCodexHooks, materializeCodexHooks } from './codex-hooks.js'

const SCRIPTS = ['lib.mjs', 'session-start.mjs', 'user-prompt-submit.mjs', 'stop.mjs'] as const

function writeFakeHookBundle(dir: string): void {
  mkdirSync(dir, { recursive: true })
  for (const f of SCRIPTS) writeFileSync(join(dir, f), `// ${f}\n`)
}

test('codexHooksComplete requires all four scripts', () => {
  const root = mkdtempSync(join(tmpdir(), 'codex-hooks-'))
  const partial = join(root, 'partial')
  mkdirSync(partial)
  writeFileSync(join(partial, 'lib.mjs'), '')
  assert.equal(codexHooksComplete(partial), false)

  const full = join(root, 'full')
  writeFakeHookBundle(full)
  assert.equal(codexHooksComplete(full), true)
})

test('installCodexHooks copies a flat vendor-style source into dest', () => {
  const root = mkdtempSync(join(tmpdir(), 'codex-hooks-'))
  const src = join(root, 'vendor')
  writeFakeHookBundle(src)
  const dest = join(root, 'dest')

  const out = materializeCodexHooks([{ dir: src, files: [...SCRIPTS] }], dest)
  assert.equal(out, dest)
  assert.ok(codexHooksComplete(dest))
})

test('installCodexHooks merges split claude + codex sources', () => {
  const root = mkdtempSync(join(tmpdir(), 'codex-hooks-'))
  const claude = join(root, 'claude')
  const codex = join(root, 'codex')
  for (const f of ['lib.mjs', 'session-start.mjs', 'user-prompt-submit.mjs']) {
    mkdirSync(claude, { recursive: true })
    writeFileSync(join(claude, f), `// ${f}\n`)
  }
  mkdirSync(codex, { recursive: true })
  writeFileSync(join(codex, 'stop.mjs'), '// stop\n')

  const dest = join(root, 'merged')
  const out = materializeCodexHooks(
    [
      { dir: claude, files: ['lib.mjs', 'session-start.mjs', 'user-prompt-submit.mjs'] },
      { dir: codex, files: ['stop.mjs'] },
    ],
    dest,
  )
  assert.equal(out, dest)
  assert.ok(codexHooksComplete(dest))
})

test('installCodexHooks returns undefined when no bundled source resolves', () => {
  const root = mkdtempSync(join(tmpdir(), 'codex-hooks-'))
  const dest = join(root, 'empty')
  mkdirSync(dest)
  writeFileSync(join(dest, 'placeholder'), '')
  // Dest with no resolvable vendor — pass a non-existent path by using materialize with [].
  assert.equal(materializeCodexHooks([], dest), undefined)
})

test('installCodexHooks materializes from monorepo plugin dirs when present', () => {
  const out = installCodexHooks(join(tmpdir(), `codex-hooks-${process.pid}-${Date.now()}`))
  // In a built monorepo checkout the plugin trees exist; in isolation this may be undefined.
  if (out) assert.ok(codexHooksComplete(out))
})
