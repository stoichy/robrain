#!/usr/bin/env node
// Copy the Hermes memory-provider plugin into vendor/ so the published
// robrain tarball can materialize it via `robrain install --hermes`
// without a repo clone — same self-containment pattern as vendor-sensing-mcp.
import { cpSync, existsSync, mkdirSync, rmSync } from 'fs'
import { basename, dirname, join } from 'path'
import { fileURLToPath } from 'url'

const cliRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(cliRoot, '..', '..', 'integrations', 'hermes', 'robrain')
const dest = join(cliRoot, 'vendor', 'hermes-plugin', 'robrain')

for (const required of ['__init__.py', 'client.py', 'plugin.yaml']) {
  if (!existsSync(join(src, required))) {
    console.error('vendor-hermes-plugin: missing', join(src, required))
    process.exit(1)
  }
}

rmSync(dest, { recursive: true, force: true })
mkdirSync(dirname(dest), { recursive: true })
cpSync(src, dest, {
  recursive: true,
  filter: p => basename(p) !== '__pycache__' && !p.endsWith('.pyc'),
})
console.log('Vendored Hermes plugin → packages/cli/vendor/hermes-plugin/robrain')
