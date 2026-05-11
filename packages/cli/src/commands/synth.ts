// packages/cli/src/commands/synth.ts
// robrain synth — run @robrain/synthesis from the robrain repo root

import { spawn } from 'child_process'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import chalk from 'chalk'

export interface SynthOptions {
  dryRun?: boolean
  lookback?: number
  project?: string
  /** Disable incremental mode — re-analyse contradiction pairs against full corpus window */
  full?: boolean
}

export async function synthCommand(opts: SynthOptions): Promise<void> {
  const env = { ...process.env }
  if (opts.dryRun) env.SYNTHESIS_DRY_RUN = 'true'
  if (opts.full) env.SYNTHESIS_INCREMENTAL = 'false'
  if (opts.lookback != null && Number.isFinite(opts.lookback)) {
    env.SYNTHESIS_LOOKBACK_DAYS = String(opts.lookback)
  }
  if (opts.project) env.SYNTHESIS_PROJECT_ID = opts.project

  console.log(chalk.dim('Running synthesis pass…'))
  const envRoot = process.env.ROBRAIN_REPO?.trim()
  const repoRoot = envRoot && envRoot.length > 0
    ? resolve(envRoot)
    : resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
  const child = spawn('pnpm', ['--filter', '@robrain/synthesis', 'start'], {
    cwd: repoRoot,
    stdio: 'inherit',
    env,
  })
  await new Promise<void>((res, rej) => {
    child.on('error', rej)
    child.on('exit', code =>
      code === 0 ? res() : rej(new Error(`synthesis exited with code ${code}`)),
    )
  })
}
