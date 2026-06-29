#!/usr/bin/env node
// Delete Algolia records whose lastCrawledAt is older than the
// threshold. Pairs with the /api/cron/evict-stale-products cron — use
// this for ad-hoc cleanup or to test the threshold before scheduling.
//
//   pnpm algolia:evict-stale                        # dry-run, 30d default
//   pnpm algolia:evict-stale --older-than 14        # dry-run, 14d
//   pnpm algolia:evict-stale --older-than 14 --apply    # delete
//
// Reads ALGOLIA_APP_ID / ALGOLIA_WRITE_API_KEY / ALGOLIA_PRODUCT_INDEX
// from .env.

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ── tiny .env loader ────────────────────────────────────────────────────
try {
  const envText = readFileSync(resolve(ROOT, '.env'), 'utf8')
  for (const line of envText.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i)
    if (!m)
      continue
    const [, key, raw] = m
    if (process.env[key] !== undefined)
      continue
    process.env[key] = raw.replace(/^["']|["']$/g, '')
  }
}
catch {}

const APP_ID = process.env.ALGOLIA_APP_ID
const WRITE_KEY = process.env.ALGOLIA_WRITE_API_KEY
const INDEX = process.env.ALGOLIA_PRODUCT_INDEX
if (!APP_ID || !WRITE_KEY || !INDEX) {
  console.error('Missing ALGOLIA_APP_ID, ALGOLIA_WRITE_API_KEY or ALGOLIA_PRODUCT_INDEX in .env.')
  process.exit(1)
}

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const olderIdx = args.indexOf('--older-than')
const rawOlder = olderIdx >= 0 ? args[olderIdx + 1] : undefined
const parsedOlder = rawOlder === undefined ? 30 : Number(rawOlder)
if (!Number.isFinite(parsedOlder)) {
  console.error('--older-than must be a finite number')
  process.exit(1)
}
const olderThanDays = Math.max(0, parsedOlder)

const SECONDS_PER_DAY = 86400
const threshold = Math.floor(Date.now() / 1000) - (olderThanDays * SECONDS_PER_DAY)
const filter = `lastCrawledAt < ${threshold}`

const READ_HOST = `https://${APP_ID}-dsn.algolia.net`
const WRITE_HOST = `https://${APP_ID}.algolia.net`
const headers = {
  'X-Algolia-API-Key': WRITE_KEY,
  'X-Algolia-Application-Id': APP_ID,
  'Content-Type': 'application/json',
}

console.log(`Eviction filter: ${filter} (records older than ${olderThanDays} day(s))`)

const countRes = await fetch(`${READ_HOST}/1/indexes/${INDEX}/query`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ params: `filters=${encodeURIComponent(filter)}&hitsPerPage=0` }),
})
if (!countRes.ok) {
  console.error(`Algolia count query failed: HTTP ${countRes.status}`)
  console.error(await countRes.text())
  process.exit(1)
}
const countJson = await countRes.json()
const nbHits = countJson.nbHits ?? 0
console.log(`Records matching: ${nbHits}\n`)

if (nbHits === 0) {
  console.log('Index is already clean for that threshold.')
  process.exit(0)
}

if (!apply) {
  console.log(`Dry-run — would delete ${nbHits} record(s).`)
  console.log(`Run with --apply to delete them.`)
  process.exit(0)
}

const delRes = await fetch(`${WRITE_HOST}/1/indexes/${INDEX}/deleteByQuery`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ params: `filters=${encodeURIComponent(filter)}` }),
})
if (!delRes.ok) {
  console.error(`deleteByQuery failed: HTTP ${delRes.status} — ${(await delRes.text()).slice(0, 200)}`)
  process.exit(1)
}
const delJson = await delRes.json()
console.log(`deleteByQuery taskID=${delJson.taskID}`)
console.log(`\nDeleted ${nbHits} record(s). Algolia reflects the change within a few seconds.`)
