// Apply versioned SQL migrations from ../migrations (F7).
// Filenames: NNN_description.sql → version NNN. $SCHEMA in file body is replaced with the active schema name.

import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))

function parseVersion(filename: string): number | null {
  const m = filename.match(/^(\d{3})_[^/]+\.sql$/i)
  return m?.[1] ? Number.parseInt(m[1], 10) : null
}

export async function applySqlMigrations(pool: pg.Pool, schema: string): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${schema}.schema_migrations (
      version     INTEGER PRIMARY KEY,
      name        TEXT NOT NULL,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  const dir  = join(__dirname, '..', 'migrations')
  const files = readdirSync(dir)
    .filter(f => f.endsWith('.sql'))
    .map(f => ({ f, v: parseVersion(f) }))
    .filter((x): x is { f: string; v: number } => x.v !== null)
    .sort((a, b) => a.v - b.v)

  const { rows: applied } = await pool.query<{ version: number }>(
    `SELECT version FROM ${schema}.schema_migrations ORDER BY version`,
  )
  const done = new Set(applied.map(r => r.version))

  for (const { f, v } of files) {
    if (done.has(v)) continue
    const raw = readFileSync(join(dir, f), 'utf8').replaceAll('$SCHEMA', schema)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(raw)
      await client.query(
        `INSERT INTO ${schema}.schema_migrations (version, name) VALUES ($1, $2)`,
        [v, f],
      )
      await client.query('COMMIT')
      console.log(`[Perception OSS] Migration ${v} applied: ${f}`)
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {})
      throw err
    } finally {
      client.release()
    }
  }
}
