// src/lib/config.ts
// ─────────────────────────────────────────────────────────────
// Manages local RoBrain config stored in ~/.robrain/config.json
// Handles: API token, user info, Rory Plans API URL, project settings
// ─────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

const CONFIG_DIR  = join(homedir(), '.robrain')
const CONFIG_FILE = join(CONFIG_DIR, 'config.json')

export interface RoMemoryConfig {
  token?:          string        // Rory Plans API token
  email?:          string        // authenticated user email
  perceptionUrl?:  string        // Rory-hosted Perception API URL
  planningUrl?:    string        // Rory-hosted Planning API URL
  perceptionKey?:  string        // Perception API key (from provision; empty for self-hosted)
  planningKey?:    string        // Planning API key (from provision; empty for self-hosted)
  embeddingProvider?: string     // openai | voyage | cohere
  embeddingKey?:   string        // embedding API key
  installedAt?:    string        // ISO date of installation
  version?:        string        // CLI version at install time
}

export function readConfig(): RoMemoryConfig {
  if (!existsSync(CONFIG_FILE)) return {}
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) as RoMemoryConfig
  } catch {
    return {}
  }
}

export function writeConfig(config: RoMemoryConfig): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true })
  }
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8')
}

export function mergeConfig(updates: Partial<RoMemoryConfig>): void {
  const current = readConfig()
  writeConfig({ ...current, ...updates })
}

export function isAuthenticated(): boolean {
  const config = readConfig()
  return !!config.token && !!config.email
}

export function getToken(): string | undefined {
  return readConfig().token
}

// Rory Plans API base URL — points to roryplans.ai auth + provisioning endpoints
export const RORY_API_BASE = process.env.RORY_API_BASE ?? 'https://api.roryplans.ai'
