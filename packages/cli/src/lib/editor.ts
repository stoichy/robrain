// src/lib/editor.ts
// ─────────────────────────────────────────────────────────────
// Detects which AI coding editors are installed and writes
// the appropriate MCP server configuration for each.
// Supported: Claude Code, Cursor, GitHub Copilot (VS Code)
// ─────────────────────────────────────────────────────────────

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { homedir } from 'os'
import { join, dirname } from 'path'

export type Editor = 'claude-code' | 'cursor' | 'copilot' | 'unknown'

export interface DetectedEditor {
  editor:     Editor
  configPath: string
  label:      string
}

// ── Detection ──────────────────────────────────────────────────

export function detectEditors(): DetectedEditor[] {
  const found: DetectedEditor[] = []
  const home = homedir()

  // Claude Code — ~/.claude/mcp.json
  const claudePath = join(home, '.claude', 'mcp.json')
  const claudeDir  = join(home, '.claude')
  if (existsSync(claudeDir) || existsSync(claudePath)) {
    found.push({ editor: 'claude-code', configPath: claudePath, label: 'Claude Code' })
  }

  // Cursor — ~/.cursor/mcp.json
  const cursorPath = join(home, '.cursor', 'mcp.json')
  const cursorDir  = join(home, '.cursor')
  if (existsSync(cursorDir) || existsSync(cursorPath)) {
    found.push({ editor: 'cursor', configPath: cursorPath, label: 'Cursor' })
  }

  // VS Code + Copilot — check for .vscode in common locations
  // Copilot MCP config lives in VS Code user settings dir
  const vscodeSettings = getVSCodeSettingsPath()
  if (vscodeSettings) {
    found.push({ editor: 'copilot', configPath: vscodeSettings, label: 'GitHub Copilot (VS Code)' })
  }

  return found
}

function getVSCodeSettingsPath(): string | null {
  const home = homedir()
  const candidates = [
    join(home, '.vscode'),
    join(home, 'Library', 'Application Support', 'Code', 'User'),  // macOS
    join(home, '.config', 'Code', 'User'),                          // Linux
    join(home, 'AppData', 'Roaming', 'Code', 'User'),              // Windows
  ]
  for (const p of candidates) {
    if (existsSync(p)) {
      return join(p, 'mcp.json')
    }
  }
  return null
}

// ── MCP config writer ──────────────────────────────────────────

export interface McpWriteOptions {
  sensingMcpPath:  string
  controlMcpPath:  string
  anthropicKey:    string
  perceptionUrl:   string
  perceptionKey:   string
  planningUrl:     string
  planningKey:     string
  embeddingProvider: string
  embeddingKey:    string
}

export function writeMcpConfig(configPath: string, opts: McpWriteOptions): void {
  // Read existing config if present
  let existing: Record<string, unknown> = {}
  if (existsSync(configPath)) {
    try {
      existing = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>
    } catch {
      existing = {}
    }
  }

  const mcpServers = (existing.mcpServers as Record<string, unknown>) ?? {}

  // Add / overwrite sensing and control
  mcpServers['robrain-sensing'] = {
    command: 'node',
    args:    [opts.sensingMcpPath],
    env: {
      ANTHROPIC_API_KEY:  opts.anthropicKey,
      EMBEDDING_PROVIDER: opts.embeddingProvider,
      ...(opts.embeddingProvider === 'openai'  && { OPENAI_API_KEY:  opts.embeddingKey }),
      ...(opts.embeddingProvider === 'voyage'  && { VOYAGE_API_KEY:  opts.embeddingKey }),
      ...(opts.embeddingProvider === 'cohere'  && { COHERE_API_KEY:  opts.embeddingKey }),
      PERCEPTION_API_URL: opts.perceptionUrl,
      PERCEPTION_API_KEY: opts.perceptionKey,
    },
  }

  mcpServers['robrain-control'] = {
    command: 'node',
    args:    [opts.controlMcpPath],
    env: {
      PLANNING_API_URL:   opts.planningUrl,
      PLANNING_API_KEY:   opts.planningKey,
      PERCEPTION_API_URL: opts.perceptionUrl,
      PERCEPTION_API_KEY: opts.perceptionKey,
    },
  }

  const updated = { ...existing, mcpServers }

  // Ensure parent directory exists
  const dir = dirname(configPath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  writeFileSync(configPath, JSON.stringify(updated, null, 2), 'utf8')
}

// ── CLAUDE.md writer ───────────────────────────────────────────

export function writeClaudeMd(projectRoot: string, projectId: string): void {
  const claudeMdPath = join(projectRoot, 'CLAUDE.md')

  // If CLAUDE.md already exists, append the RoBrain block
  let existing = ''
  if (existsSync(claudeMdPath)) {
    existing = readFileSync(claudeMdPath, 'utf8')
    // Don't double-write if already configured
    if (existing.includes('<!-- robrain -->')) return
    existing = existing.trimEnd() + '\n\n'
  }

  const block = `<!-- robrain -->
## RoBrain — Context Management

This project uses RoBrain for persistent institutional memory across sessions.
Call these tools as instructed to maintain causal memory of decisions.

### Session start (every session, first thing)
\`\`\`
sensing_start_session(project_id="${projectId}", session_id="<ISO-timestamp>-<4-random-chars>", working_dir="<cwd>")
control_get_session_context(project_id="${projectId}", session_id="<same-id>")
\`\`\`
Inject the always_on_summary returned by control_get_session_context into your context.

### After every response
\`\`\`
sensing_record_turn(session_id=..., sequence=<n>, user_message=..., claude_reply=..., files_touched=[...], injected_memory_ids=[...])
\`\`\`
If topic_shift=true is returned, immediately call:
\`\`\`
control_inject_context(project_id="${projectId}", session_id=..., task_description=..., files_in_scope=[...])
\`\`\`

### When you need deeper context
\`\`\`
control_get_context(project_id="${projectId}", session_id=..., query=..., files_relevant=[...])
\`\`\`

### When prior context is wrong or outdated
\`\`\`
control_record_correction(session_id=..., decision_id=..., source="user_correction"|"claude_disagreement", invalidate=true)
\`\`\`

### When user adds a rule
\`\`\`
control_add_rule(project_id="${projectId}", rule="...", type="always_include"|"always_exclude"|"preference")
\`\`\`

### Session end (last thing)
\`\`\`
sensing_end_session(session_id=..., summary="one sentence: what was accomplished")
control_end_session(project_id="${projectId}", session_id=...)
\`\`\`

### Acknowledgement rule
When injected context contains a question marked ⚠, you must explicitly state
whether the constraint applies to the current task before proceeding.
<!-- /robrain -->
`

  writeFileSync(claudeMdPath, existing + block, 'utf8')
}
