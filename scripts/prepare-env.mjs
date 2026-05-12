#!/usr/bin/env node
// scripts/prepare-env.mjs
// ─────────────────────────────────────────────────────────────
// Run before `docker compose ... up`.
//
// Ensures the repo-root .env exists and has non-empty values for:
//   - PERCEPTION_API_KEY  (random 32-byte hex)
//   - POSTGRES_PASSWORD   (random 32-byte hex)
//
// Also rewrites DATABASE_URL to include POSTGRES_PASSWORD when the URL still
// carries the placeholder `CHANGE_ME` from .env.example.
//
// Idempotent. Existing non-empty values are never overwritten.
// ─────────────────────────────────────────────────────────────

import { randomBytes } from 'node:crypto'
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = resolve(repoRoot, '.env')
const examplePath = resolve(repoRoot, '.env.example')

if (!existsSync(envPath)) {
  if (!existsSync(examplePath)) {
    console.error('[prepare-env] .env.example missing — cannot bootstrap .env')
    process.exit(1)
  }
  copyFileSync(examplePath, envPath)
  console.log('[prepare-env] created .env from .env.example')
}

const original = readFileSync(envPath, 'utf8')
const lines = original.split('\n')

const generated = {}
function ensureRandom(key) {
  const idx = lines.findIndex(l => l.match(new RegExp(`^\\s*${key}\\s*=`)))
  if (idx === -1) {
    const value = randomBytes(32).toString('hex')
    lines.push(`${key}=${value}`)
    generated[key] = value
    return value
  }
  const current = lines[idx].replace(new RegExp(`^\\s*${key}\\s*=\\s*`), '').trim()
  if (current.length > 0 && current !== 'CHANGE_ME') return current
  const value = randomBytes(32).toString('hex')
  lines[idx] = `${key}=${value}`
  generated[key] = value
  return value
}

const postgresPassword = ensureRandom('POSTGRES_PASSWORD')
ensureRandom('PERCEPTION_API_KEY')

// Refresh DATABASE_URL if it still carries the .env.example placeholder.
const dbIdx = lines.findIndex(l => l.match(/^\s*DATABASE_URL\s*=/))
if (dbIdx !== -1) {
  const current = lines[dbIdx].replace(/^\s*DATABASE_URL\s*=\s*/, '').trim()
  if (/CHANGE_ME/.test(current)) {
    const userIdx = lines.findIndex(l => l.match(/^\s*POSTGRES_USER\s*=/))
    const dbNameIdx = lines.findIndex(l => l.match(/^\s*POSTGRES_DB\s*=/))
    const portIdx = lines.findIndex(l => l.match(/^\s*POSTGRES_PORT\s*=/))
    const user = userIdx !== -1 ? lines[userIdx].split('=')[1].trim() : 'robrain'
    const db = dbNameIdx !== -1 ? lines[dbNameIdx].split('=')[1].trim() : 'robrain'
    const port = portIdx !== -1 ? lines[portIdx].split('=')[1].trim() : '5432'
    lines[dbIdx] = `DATABASE_URL=postgres://${user}:${postgresPassword}@localhost:${port}/${db}`
    generated.DATABASE_URL = '<rewritten with new POSTGRES_PASSWORD>'
  }
}

const next = lines.join('\n')
if (next !== original) {
  writeFileSync(envPath, next)
  for (const [k, v] of Object.entries(generated)) {
    const display = v.length > 12 ? `${v.slice(0, 8)}…${v.slice(-4)}` : v
    console.log(`[prepare-env] generated ${k}=${display}`)
  }
}
