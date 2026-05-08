// src/lib/memory-paths.ts
// ─────────────────────────────────────────────────────────────
// Resolve Claude Code's auto-memory directory for the current
// project. Auto-memory keys by a path-derived slug:
//   /Users/foo/bar  →  -Users-foo-bar
// and lives at:
//   ~/.claude/projects/<slug>/memory/
// ─────────────────────────────────────────────────────────────

import { homedir } from 'os'
import { join }    from 'path'

/** Slugify an absolute cwd the same way Claude Code does. */
export function slugifyCwd(cwd: string): string {
  return cwd.replace(/\//g, '-')
}

/** Default auto-memory directory for a given project cwd. */
export function defaultMemoryDir(cwd: string): string {
  return join(homedir(), '.claude', 'projects', slugifyCwd(cwd), 'memory')
}

/** Path to the always-loaded index file inside the memory dir. */
export function memoryIndexPath(memoryDir: string): string {
  return join(memoryDir, 'MEMORY.md')
}
