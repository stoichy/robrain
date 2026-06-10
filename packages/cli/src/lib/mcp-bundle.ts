// packages/cli/src/lib/mcp-bundle.ts
// Copy or symlink built MCP packages into ~/.robrain/mcp so editor configs resolve.

import { cpSync, existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'fs'
import { platform } from 'os'
import { join } from 'path'

export class McpBundleError extends Error {
  override name = 'McpBundleError'
}

/**
 * True only when a *complete* Sensing bundle is present — both the entrypoint and
 * a package.json declaring ESM. The package.json check is load-bearing: Node treats
 * a bare `.js` without `"type": "module"` as CommonJS and throws on the bundle's
 * `import` statements before any tool registers. A previous half-finished copy
 * (entrypoint present, package.json missing) must therefore read as NOT ready so
 * the install re-materializes it instead of certifying the wreck and writing a
 * success config on top of it.
 */
export function sensingBundleReady(robrainMcpDir: string): boolean {
  const base = join(robrainMcpDir, 'sensing')
  return existsSync(join(base, 'dist', 'index.js')) && existsSync(join(base, 'package.json'))
}

/** True when a Control MCP entrypoint exists (cloud installs only; not in OSS repo). */
export function controlBundleReady(robrainMcpDir: string): boolean {
  return existsSync(join(robrainMcpDir, 'control', 'dist', 'index.js'))
}

/**
 * Ensure ~/.robrain/mcp/sensing resolves to a built sensing-mcp bundle.
 *
 * macOS/Linux: directory symlink into the workspace package — the package's own
 * package.json and (for dev rebuilds) a fresh dist are picked up automatically.
 *
 * Windows: copy the *self-contained* artifact only — the bundled dist plus a
 * minimal package.json declaring ESM. We deliberately do NOT copy the package's
 * node_modules: in a pnpm workspace those entries are symlinks into the monorepo's
 * virtual store (e.g. `@robrain/shared -> ../../../shared`). Copied out of the repo
 * they dangle, and on Windows recreating them can abort the copy partway — which is
 * exactly what produced half-installed, crash-looping Sensing servers. Because the
 * server is bundled into one file with every dependency inlined, no node_modules is
 * needed at the destination.
 */
export function ensureSensingMcpBundle(repoRoot: string, robrainMcpDir: string): void {
  if (sensingBundleReady(robrainMcpDir)) return

  const src = join(repoRoot, 'packages', 'sensing-mcp')
  const srcEntry = join(src, 'dist', 'index.js')
  if (!existsSync(srcEntry)) {
    throw new McpBundleError(
      `sensing-mcp is not built (missing ${srcEntry}). From the repo root run: pnpm install && pnpm build`,
    )
  }

  mkdirSync(robrainMcpDir, { recursive: true })
  const dest = join(robrainMcpDir, 'sensing')

  if (existsSync(dest)) {
    rmSync(dest, { recursive: true, force: true })
  }

  if (platform() === 'win32') {
    mkdirSync(dest, { recursive: true })
    cpSync(join(src, 'dist'), join(dest, 'dist'), { recursive: true })
    // Minimal package.json: Node needs "type": "module" to run the bundled
    // ESM entrypoint. The workspace package.json's `dependencies` are irrelevant
    // at runtime (everything is inlined) and only invite confusion, so omit them.
    writeFileSync(
      join(dest, 'package.json'),
      JSON.stringify(
        { name: 'robrain-sensing-mcp', private: true, type: 'module', main: './dist/index.js' },
        null,
        2,
      ) + '\n',
    )
  } else {
    symlinkSync(src, dest, 'dir')
  }
}
