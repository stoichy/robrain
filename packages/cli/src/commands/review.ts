// src/commands/review.ts
// ─────────────────────────────────────────────────────────────
// robrain review [--session last|SESSION_ID] [--all] [--limit N]
//
// Shows decisions captured in recent sessions so developers can
// review what the system stored, edit wrong decisions, and delete
// hallucinated ones before they pollute future injections.
//
// This is the trust layer — developers should never have to rely
// on memories they've never seen.
// ─────────────────────────────────────────────────────────────

import chalk   from 'chalk'
import ora     from 'ora'
import prompts from 'prompts'
import { readConfig, isAuthenticated } from '../lib/config.js'
import { gatherProjectInfo }           from '../lib/project.js'
import { cwd }                         from 'process'

interface ReviewOptions {
  session?: string    // 'last' | session_id
  all?:     boolean   // show all decisions, not just last session
  limit?:   number    // max decisions to show (default 20)
}

interface StoredDecision {
  id:             string
  decision:       string
  rationale:      string | null
  rejected:       Array<{ option: string; reason: string }>
  files_affected: string[]
  confidence:     number
  scope:          string
  created_at:     string
  session_id:     string
  conflict_flag:  boolean
}

export async function reviewCommand(opts: ReviewOptions): Promise<void> {
  console.log()

  if (!isAuthenticated()) {
    console.log(chalk.red('  ✗ Not authenticated. Run: robrain install'))
    process.exit(1)
  }

  const config  = readConfig()
  const info    = gatherProjectInfo(cwd())
  const percUrl = config.perceptionUrl
  const percKey = config.perceptionKey ?? ''

  if (!percUrl) {
    console.log(chalk.red('  ✗ Perception URL not configured. Run: robrain install'))
    process.exit(1)
  }

  // ── Fetch decisions from Perception ───────────────────────
  const spinner = ora({ text: 'Fetching stored decisions...', color: 'green' }).start()

  const limit = opts.limit ?? 20
  const params = new URLSearchParams({
    project_id: info.id,
    limit:      String(limit),
    ...(opts.session && opts.session !== 'last' && { session_id: opts.session }),
    ...(opts.all     ? { all: 'true' }            : { recent: 'true' }),
  })

  let decisions: StoredDecision[] = []

  try {
    const res = await fetch(`${percUrl}/decisions?${params}`, {
      headers: percKey ? { 'Authorization': `Bearer ${percKey}` } : {},
    })

    if (!res.ok) {
      spinner.fail(`Could not fetch decisions (${res.status})`)
      process.exit(1)
    }

    const data = await res.json() as { decisions: StoredDecision[] }
    decisions  = data.decisions ?? []
  } catch {
    spinner.fail('Could not reach Perception API')
    process.exit(1)
  }

  spinner.stop()

  if (decisions.length === 0) {
    console.log(chalk.dim(`  No decisions stored yet for ${chalk.bold(info.name)}.`))
    console.log(chalk.dim('  Run a Claude Code session to start capturing memory.\n'))
    return
  }

  // ── Display header ─────────────────────────────────────────
  console.log(chalk.bold(`  Memory review — ${info.name}`))
  console.log(chalk.dim(`  ${decisions.length} decision${decisions.length === 1 ? '' : 's'} stored · Project ID: ${info.id}\n`))

  // ── Display each decision ──────────────────────────────────
  for (let i = 0; i < decisions.length; i++) {
    const d     = decisions[i]
    const index = chalk.dim(`[${i + 1}/${decisions.length}]`)
    const date  = new Date(d.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    const conf  = d.confidence >= 0.9 ? chalk.green('high')
                : d.confidence >= 0.6 ? chalk.yellow('medium')
                : chalk.red('low')

    // Conflict flag warning
    if (d.conflict_flag) {
      console.log(chalk.yellow('  ⚠ CONFLICT — needs resolution'))
    }

    console.log(`  ${index} ${chalk.bold(d.decision)}`)

    if (d.rationale) {
      console.log(chalk.dim(`     because: `) + d.rationale)
    }

    if (d.rejected.length > 0) {
      const vetoes = d.rejected.map(r => `${chalk.dim(r.option)} ${chalk.dim(`(${r.reason})`)}`).join(', ')
      console.log(chalk.dim(`     rejected: `) + vetoes)
    }

    if (d.files_affected.length > 0) {
      console.log(chalk.dim(`     files:    `) + d.files_affected.slice(0, 3).join(', ') + (d.files_affected.length > 3 ? ` +${d.files_affected.length - 3} more` : ''))
    }

    console.log(chalk.dim(`     ${date} · confidence: `) + conf + chalk.dim(` · scope: ${d.scope}`))
    console.log()
  }

  // ── Interactive review ─────────────────────────────────────
  const { action } = await prompts({
    type:    'select',
    name:    'action',
    message: 'What would you like to do?',
    choices: [
      { title: 'Done — looks good',              value: 'done' },
      { title: 'Edit a decision',                value: 'edit' },
      { title: 'Delete a decision',              value: 'delete' },
      { title: 'Mark a conflict as resolved',    value: 'resolve' },
    ],
  })

  if (!action || action === 'done') {
    console.log(chalk.green('\n  ✓ Memory review complete\n'))
    return
  }

  if (action === 'edit') {
    await editDecision(decisions, percUrl, percKey, info.id)
  }

  if (action === 'delete') {
    await deleteDecision(decisions, percUrl, percKey)
  }

  if (action === 'resolve') {
    await resolveConflict(decisions, percUrl, percKey, info.id)
  }
}

// ── Edit a decision ────────────────────────────────────────────

async function editDecision(
  decisions: StoredDecision[],
  percUrl: string,
  percKey: string,
  projectId: string,
): Promise<void> {
  const choices = decisions.map((d, i) => ({
    title: `[${i + 1}] ${d.decision.slice(0, 60)}${d.decision.length > 60 ? '...' : ''}`,
    value: d.id,
  }))

  const { id } = await prompts({
    type:    'select',
    name:    'id',
    message: 'Which decision to edit?',
    choices,
  })

  if (!id) return

  const decision = decisions.find(d => d.id === id)!

  const { newDecision } = await prompts({
    type:    'text',
    name:    'newDecision',
    message: 'Corrected decision:',
    initial:  decision.decision,
  })

  const { newRationale } = await prompts({
    type:    'text',
    name:    'newRationale',
    message: 'Corrected rationale (clear field to remove):',
    initial:  decision.rationale ?? '',
  })

  const spinner = ora('Saving correction...').start()

  // Empty / whitespace-only string clears rationale; cancelled prompt keeps prior value.
  let correctedRationale: string | null
  if (newRationale == null) {
    correctedRationale = decision.rationale ?? null
  } else if (newRationale.trim() === '') {
    correctedRationale = null
  } else {
    correctedRationale = newRationale
  }

  try {
    const res = await fetch(`${percUrl}/corrections`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        ...(percKey ? { 'Authorization': `Bearer ${percKey}` } : {}),
        'X-Project-Id':  projectId,
        'X-Session-Id':  'robrain-review-cli',
      },
      body: JSON.stringify({
        decision_id:          id,
        corrected_decision:   newDecision,
        corrected_rationale:  correctedRationale,
        invalidate:           true,
        source:               'user_correction',
      }),
    })

    if (res.ok) {
      spinner.succeed(`Decision updated. Old version preserved in history.`)
    } else {
      spinner.fail('Could not save correction')
    }
  } catch {
    spinner.fail('Could not reach Perception API')
  }

  console.log()
}

// ── Delete a decision ──────────────────────────────────────────

async function deleteDecision(
  decisions: StoredDecision[],
  percUrl: string,
  percKey: string,
): Promise<void> {
  const choices = decisions.map((d, i) => ({
    title: `[${i + 1}] ${d.decision.slice(0, 60)}${d.decision.length > 60 ? '...' : ''}`,
    value: d.id,
  }))

  const { id } = await prompts({
    type:    'select',
    name:    'id',
    message: 'Which decision to delete?',
    choices,
  })

  if (!id) return

  const { confirm } = await prompts({
    type:    'confirm',
    name:    'confirm',
    message: chalk.yellow('This will invalidate the decision. It won\'t be injected in future sessions but stays in history. Continue?'),
    initial:  false,
  })

  if (!confirm) return

  const spinner = ora('Invalidating decision...').start()

  try {
    const res = await fetch(`${percUrl}/corrections`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        ...(percKey ? { 'Authorization': `Bearer ${percKey}` } : {}),
      },
      body: JSON.stringify({
        decision_id: id,
        invalidate:  true,
        source:      'user_correction',
      }),
    })

    if (res.ok) {
      spinner.succeed('Decision invalidated — won\'t be injected in future sessions.')
    } else {
      spinner.fail('Could not invalidate decision')
    }
  } catch {
    spinner.fail('Could not reach Perception API')
  }

  console.log()
}

// ── Resolve a conflict ─────────────────────────────────────────

async function resolveConflict(
  decisions: StoredDecision[],
  percUrl: string,
  percKey: string,
  projectId: string,
): Promise<void> {
  const conflicts = decisions.filter(d => d.conflict_flag)

  if (conflicts.length === 0) {
    console.log(chalk.dim('\n  No pending conflicts.\n'))
    return
  }

  const choices = conflicts.map((d, i) => ({
    title: `[${i + 1}] ${d.decision.slice(0, 60)}`,
    value: d.id,
  }))

  const { id } = await prompts({
    type:    'select',
    name:    'id',
    message: 'Which conflict to resolve?',
    choices,
  })

  if (!id) return

  const { resolution } = await prompts({
    type:    'select',
    name:    'resolution',
    message: 'How should this be resolved?',
    choices: [
      { title: 'Keep this decision — it\'s correct', value: 'keep' },
      { title: 'Invalidate this — the older decision stands', value: 'invalidate' },
    ],
  })

  const spinner = ora('Resolving conflict...').start()

  try {
    const res = await fetch(`${percUrl}/corrections`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        ...(percKey ? { 'Authorization': `Bearer ${percKey}` } : {}),
        'X-Project-Id':  projectId,
        'X-Session-Id':  'robrain-review-cli',
      },
      body: JSON.stringify({
        decision_id: id,
        invalidate:  resolution === 'invalidate',
        source:      'user_correction',
      }),
    })

    if (res.ok) {
      spinner.succeed(resolution === 'keep'
        ? 'Conflict resolved — decision kept and conflict flag cleared.'
        : 'Conflict resolved — decision invalidated.')
    } else {
      spinner.fail('Could not resolve conflict')
    }
  } catch {
    spinner.fail('Could not reach Perception API')
  }

  console.log()
}
