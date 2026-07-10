// packages/cli/src/lib/hermes-plugin.test.ts
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  HermesPluginError,
  hermesPluginComplete,
  installHermesPlugin,
  resolveHermesHome,
} from './hermes-plugin.js'

function makePluginSource(root: string): string {
  const src = join(root, 'src-plugin')
  mkdirSync(src, { recursive: true })
  writeFileSync(join(src, '__init__.py'), '# provider\n')
  writeFileSync(join(src, 'client.py'), '# client\n')
  writeFileSync(join(src, 'plugin.yaml'), 'name: robrain\n')
  writeFileSync(join(src, 'README.md'), '# docs\n')
  mkdirSync(join(src, '__pycache__'))
  writeFileSync(join(src, '__pycache__', 'junk.pyc'), '')
  return src
}

test('resolveHermesHome prefers HERMES_HOME env', () => {
  assert.equal(resolveHermesHome({ HERMES_HOME: '/custom/home' }), '/custom/home')
})

test('resolveHermesHome defaults under the user home when env unset', () => {
  const resolved = resolveHermesHome({})
  assert.ok(resolved.includes('hermes'))
})

test('installs plugin into <home>/plugins/robrain, excluding __pycache__', () => {
  const root = mkdtempSync(join(tmpdir(), 'hermes-plugin-'))
  const src = makePluginSource(root)
  const home = join(root, 'hermes-home')

  const { dest } = installHermesPlugin(home, src)

  assert.equal(dest, join(home, 'plugins', 'robrain'))
  assert.ok(hermesPluginComplete(dest))
  assert.ok(!readdirSync(dest).includes('__pycache__'))
})

test('replaces an existing install, including a dangling symlink', () => {
  const root = mkdtempSync(join(tmpdir(), 'hermes-plugin-'))
  const src = makePluginSource(root)
  const home = join(root, 'hermes-home')
  mkdirSync(join(home, 'plugins'), { recursive: true })
  symlinkSync(join(root, 'nowhere'), join(home, 'plugins', 'robrain'))

  const { dest } = installHermesPlugin(home, src)
  assert.ok(hermesPluginComplete(dest))
})

test('throws when the source is missing or incomplete', () => {
  const root = mkdtempSync(join(tmpdir(), 'hermes-plugin-'))
  const incomplete = join(root, 'incomplete')
  mkdirSync(incomplete)
  writeFileSync(join(incomplete, '__init__.py'), '')

  assert.throws(() => installHermesPlugin(join(root, 'home'), incomplete), HermesPluginError)
  // '' = "resolution found nothing" — passing undefined would re-trigger the
  // default resolver, which legitimately finds the real plugin in a monorepo.
  assert.throws(() => installHermesPlugin(join(root, 'home'), ''), HermesPluginError)
})
