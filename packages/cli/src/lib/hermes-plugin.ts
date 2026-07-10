// packages/cli/src/lib/hermes-plugin.ts
// Materialize the Hermes memory-provider plugin into $HERMES_HOME/plugins.
//
// hermes-agent's contribution policy keeps memory providers out of their
// tree — providers install as standalone plugins under ~/.hermes/plugins/,
// where Hermes' discovery loads them with the same lifecycle hooks as
// bundled ones. `robrain install --hermes` performs that copy so no repo
// clone is needed: published tarballs carry the plugin under
// vendor/hermes-plugin (same self-containment pattern as the vendored
// sensing-mcp bundle); monorepo dev resolves integrations/hermes.

import { cpSync, existsSync, lstatSync, mkdirSync, rmSync, unlinkSync } from 'fs'
import { homedir, platform } from 'os'
import { basename, dirname, join } from 'path'
import { fileURLToPath } from 'url'

export class HermesPluginError extends Error {
  override name = 'HermesPluginError'
}

/** Files that must exist for a plugin source dir to be considered complete. */
const REQUIRED_FILES = ['__init__.py', 'client.py', 'plugin.yaml']

/** Remove whatever sits at `dest`, including a dangling symlink (see mcp-bundle.ts). */
function removeDest(dest: string): void {
  let stats
  try {
    stats = lstatSync(dest)
  } catch {
    return
  }
  if (stats.isSymbolicLink()) unlinkSync(dest)
  else rmSync(dest, { recursive: true, force: true })
}

/**
 * Hermes home resolution — mirrors hermes_constants.get_hermes_home():
 * HERMES_HOME env var, else the platform-native default (~/.hermes on
 * macOS/Linux, %LOCALAPPDATA%\hermes on Windows).
 */
export function resolveHermesHome(env: NodeJS.ProcessEnv = process.env): string {
  const fromEnv = env.HERMES_HOME?.trim()
  if (fromEnv) return fromEnv
  if (platform() === 'win32') {
    const localAppData = env.LOCALAPPDATA?.trim()
    return join(localAppData || join(homedir(), 'AppData', 'Local'), 'hermes')
  }
  return join(homedir(), '.hermes')
}

export function hermesPluginComplete(dir: string): boolean {
  return REQUIRED_FILES.every(f => existsSync(join(dir, f)))
}

/**
 * Locate the plugin source shipped with this CLI.
 * Published tarballs carry it under vendor/hermes-plugin/robrain;
 * monorepo dev resolves integrations/hermes/robrain from the repo root.
 */
export function resolveHermesPluginSourceDir(): string | undefined {
  // Compiled location: <cli-root>/dist/lib/hermes-plugin.js — cli root is two up.
  const here = dirname(fileURLToPath(import.meta.url))
  const cliRoot = join(here, '..', '..')
  const candidates = [
    join(cliRoot, 'vendor', 'hermes-plugin', 'robrain'),          // published tarball
    join(cliRoot, '..', '..', 'integrations', 'hermes', 'robrain'), // monorepo dev
  ]
  return candidates.find(hermesPluginComplete)
}

export interface HermesInstallResult {
  dest: string
  hermesHome: string
}

/**
 * Copy the plugin into `<hermesHome>/plugins/robrain`, replacing whatever is
 * there (including dangling symlinks and half-finished copies). Throws
 * HermesPluginError when no complete source ships with this CLI build.
 * Exposed with an explicit `sourceDir` for tests.
 */
export function installHermesPlugin(
  hermesHome: string = resolveHermesHome(),
  sourceDir: string | undefined = resolveHermesPluginSourceDir(),
): HermesInstallResult {
  if (!sourceDir || !hermesPluginComplete(sourceDir)) {
    throw new HermesPluginError(
      'Hermes plugin source not found in this CLI build — expected vendor/hermes-plugin (published) or integrations/hermes (repo clone).',
    )
  }

  const pluginsDir = join(hermesHome, 'plugins')
  const dest = join(pluginsDir, 'robrain')
  mkdirSync(pluginsDir, { recursive: true })
  removeDest(dest)
  cpSync(sourceDir, dest, {
    recursive: true,
    filter: src => basename(src) !== '__pycache__' && !src.endsWith('.pyc'),
  })

  if (!hermesPluginComplete(dest)) {
    throw new HermesPluginError(`Hermes plugin copy to ${dest} is incomplete — re-run the install.`)
  }
  return { dest, hermesHome }
}
