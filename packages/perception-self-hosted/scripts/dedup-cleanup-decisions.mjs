#!/usr/bin/env node
// packages/perception-self-hosted/scripts/dedup-cleanup-decisions.mjs
// One-shot cleanup of near-duplicate active decisions.
//
// Usage (run from this package dir; pg is resolved here):
//   node scripts/dedup-cleanup-decisions.mjs              # dry-run (default)
//   node scripts/dedup-cleanup-decisions.mjs --apply      # commit
//   node scripts/dedup-cleanup-decisions.mjs --threshold=0.90
//   node scripts/dedup-cleanup-decisions.mjs --project=<id>
//
// What it does:
//   - Finds clusters of active (invalidated_at IS NULL) decisions in the same
//     (project_id, scope) where cosine similarity >= threshold.
//   - Picks a canonical per cluster: oldest reviewed_at, else oldest created_at.
//   - Invalidates non-canonicals (invalidated_at = now(), auto_resolved = true).
//   - Soft-only — never hard-deletes, never sets supersedes_id.

import pg from 'pg'

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/)
    return m ? [m[1], m[2] ?? true] : [a, true]
  }),
)

const APPLY     = args.apply === true
const THRESHOLD = Number(args.threshold ?? 0.85)
const PROJECT   = typeof args.project === 'string' ? args.project : null
const SCHEMA    = process.env.DB_SCHEMA ?? 'context_system'
const DB_URL =
  process.env.DATABASE_URL ??
  `postgres://${process.env.POSTGRES_USER ?? 'robrain'}:${process.env.POSTGRES_PASSWORD ?? 'robrain'}@localhost:${process.env.POSTGRES_PORT ?? 5432}/${process.env.POSTGRES_DB ?? 'robrain'}`

if (Number.isNaN(THRESHOLD) || THRESHOLD <= 0 || THRESHOLD > 1) {
  console.error(`Bad --threshold: ${args.threshold}`)
  process.exit(2)
}

const pool = new pg.Pool({ connectionString: DB_URL, max: 4 })

const projectFilterSQL = PROJECT ? `AND a.project_id = $2 AND b.project_id = $2` : ''
const projectParams    = PROJECT ? [THRESHOLD, PROJECT] : [THRESHOLD]

const PAIRS_SQL = `
  SELECT
    a.id           AS a_id,
    b.id           AS b_id,
    a.project_id   AS project_id,
    a.scope        AS scope,
    1 - (a.embedding <=> b.embedding) AS similarity
  FROM ${SCHEMA}.decisions a
  JOIN ${SCHEMA}.decisions b
    ON a.id < b.id
   AND a.project_id = b.project_id
   AND a.scope      = b.scope
  WHERE a.invalidated_at IS NULL
    AND b.invalidated_at IS NULL
    AND a.embedding IS NOT NULL
    AND b.embedding IS NOT NULL
    AND 1 - (a.embedding <=> b.embedding) >= $1
    ${projectFilterSQL}
  ORDER BY a.project_id, a.scope, similarity DESC
`

const ROWS_SQL = `
  SELECT id, project_id, scope, decision, created_at, reviewed_at
  FROM ${SCHEMA}.decisions
  WHERE id = ANY($1::text[])
`

function formUnionFindClusters(pairs) {
  const parent = new Map()
  const find = x => {
    let r = x
    while (parent.get(r) !== r) r = parent.get(r)
    let cur = x
    while (parent.get(cur) !== r) {
      const next = parent.get(cur)
      parent.set(cur, r)
      cur = next
    }
    return r
  }
  const union = (a, b) => {
    if (!parent.has(a)) parent.set(a, a)
    if (!parent.has(b)) parent.set(b, b)
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }
  for (const { a_id, b_id } of pairs) union(a_id, b_id)
  const clusters = new Map()
  for (const id of parent.keys()) {
    const root = find(id)
    if (!clusters.has(root)) clusters.set(root, [])
    clusters.get(root).push(id)
  }
  return [...clusters.values()].map(ids => ids.sort())
}

function pickCanonical(rows) {
  // 1) oldest reviewed_at, 2) else oldest created_at
  const reviewed = rows.filter(r => r.reviewed_at != null)
  const pool     = reviewed.length ? reviewed : rows
  return [...pool].sort((a, b) => {
    const ka = (reviewed.length ? a.reviewed_at : a.created_at).getTime()
    const kb = (reviewed.length ? b.reviewed_at : b.created_at).getTime()
    return ka - kb
  })[0]
}

const truncate = (s, n = 80) => {
  const oneLine = s.replace(/\s+/g, ' ').trim()
  return oneLine.length > n ? oneLine.slice(0, n - 1) + '…' : oneLine
}

async function main() {
  console.log(`# RoBrain dedup cleanup`)
  console.log(`  threshold : >= ${THRESHOLD}`)
  console.log(`  project   : ${PROJECT ?? '(all)'}`)
  console.log(`  mode      : ${APPLY ? 'APPLY (will write)' : 'dry-run (no writes)'}`)
  console.log(`  database  : ${DB_URL.replace(/:[^:@/]+@/, ':***@')}`)
  console.log()

  const { rows: pairs } = await pool.query(PAIRS_SQL, projectParams)
  if (pairs.length === 0) {
    console.log('No near-duplicate pairs found. Nothing to do.')
    await pool.end()
    return
  }

  const clusters = formUnionFindClusters(pairs)
  const allIds   = clusters.flat()
  const { rows } = await pool.query(ROWS_SQL, [allIds])
  const byId     = new Map(rows.map(r => [r.id, r]))

  let invalidatedTotal = 0
  const plan = [] // { keep_id, kill_ids[], project_id, scope, lines }

  for (const ids of clusters) {
    const cluster = ids.map(id => byId.get(id)).filter(Boolean)
    if (cluster.length < 2) continue
    const canonical = pickCanonical(cluster)
    const kill      = cluster.filter(r => r.id !== canonical.id)
    invalidatedTotal += kill.length

    const lines = [
      `── cluster (${cluster.length} rows) — project=${canonical.project_id} scope=${canonical.scope}`,
      `   KEEP   ${canonical.id}  reviewed=${canonical.reviewed_at != null}  created=${canonical.created_at.toISOString()}`,
      `          "${truncate(canonical.decision)}"`,
      ...kill.map(r =>
        `   DROP   ${r.id}  reviewed=${r.reviewed_at != null}  created=${r.created_at.toISOString()}\n          "${truncate(r.decision)}"`,
      ),
    ]
    plan.push({
      keep_id: canonical.id,
      kill_ids: kill.map(r => r.id),
      project_id: canonical.project_id,
      scope: canonical.scope,
      lines,
    })
  }

  for (const p of plan) console.log(p.lines.join('\n'))
  console.log()
  console.log(`Summary: ${plan.length} cluster(s), ${invalidatedTotal} row(s) would be invalidated.`)

  if (!APPLY) {
    console.log('\nDry-run complete. Re-run with --apply to commit.')
    await pool.end()
    return
  }

  if (invalidatedTotal === 0) {
    await pool.end()
    return
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const killIds = plan.flatMap(p => p.kill_ids)
    const res = await client.query(
      `UPDATE ${SCHEMA}.decisions
         SET invalidated_at = now(),
             auto_resolved  = true,
             updated_at     = now()
       WHERE id = ANY($1::text[])
         AND invalidated_at IS NULL
       RETURNING id`,
      [killIds],
    )
    await client.query('COMMIT')
    console.log(`\nApplied: invalidated ${res.rowCount} row(s).`)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('FAILED — rolled back.', err)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
