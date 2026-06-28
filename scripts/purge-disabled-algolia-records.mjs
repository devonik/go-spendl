#!/usr/bin/env node
// Delete Algolia records whose shopDomain matches a now-disabled slug
// in `server/data/store-overrides.json` (crawl.crawlable === false).
// Useful after running `pnpm stores:disable-missing --apply` to keep the
// index tidy.
//
//   pnpm algolia:purge-disabled            # dry-run, shows per-shop counts
//   pnpm algolia:purge-disabled --apply    # actually delete
//
// Reads ALGOLIA_APP_ID / ALGOLIA_WRITE_API_KEY / ALGOLIA_PRODUCT_INDEX
// from .env. The write key is required because deleteByQuery is a write
// operation.

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

const args = new Set(process.argv.slice(2))
const apply = args.has('--apply')

const overrides = JSON.parse(readFileSync(resolve(ROOT, 'server/data/store-overrides.json'), 'utf8'))
const disabledSlugs = Object.entries(overrides)
  .filter(([, s]) => s.crawl && s.crawl.crawlable === false)
  .map(([slug]) => slug)
console.log(`${disabledSlugs.length} disabled slugs in store-overrides.json.`)

if (disabledSlugs.length === 0) {
  console.log('Nothing to do.')
  process.exit(0)
}

// Read host is *-dsn; write host is bare. Algolia routes write ops via
// the bare host (it doesn't matter which one we use for the facet query).
const READ_HOST = `https://${APP_ID}-dsn.algolia.net`
const WRITE_HOST = `https://${APP_ID}.algolia.net`
const headers = {
  'X-Algolia-API-Key': WRITE_KEY,
  'X-Algolia-Application-Id': APP_ID,
  'Content-Type': 'application/json',
}

console.log('Fetching Algolia shopDomain facets to size the delete…')
const facetRes = await fetch(`${READ_HOST}/1/indexes/${INDEX}/query`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ params: 'facets=["shopDomain"]&hitsPerPage=0&maxValuesPerFacet=1000' }),
})
if (!facetRes.ok) {
  console.error(`Algolia facet query failed: HTTP ${facetRes.status}`)
  console.error(await facetRes.text())
  process.exit(1)
}
const facetJson = await facetRes.json()
const facets = facetJson.facets?.shopDomain || {}

const toDelete = disabledSlugs
  .map(slug => ({ slug, count: facets[slug] || 0 }))
  .filter(s => s.count > 0)

const totalRecords = toDelete.reduce((a, s) => a + s.count, 0)
console.log(`${toDelete.length} of those have records in Algolia (${totalRecords} record(s) total).\n`)

if (toDelete.length === 0) {
  console.log('Index is already clean for disabled shops.')
  process.exit(0)
}

if (!apply) {
  console.log('Dry-run — would delete:')
  for (const { slug, count } of toDelete)
    console.log(`  ${slug.padEnd(38, ' ')} ${count} record(s)`)
  console.log(`\nRun with --apply to delete ${totalRecords} records.`)
  process.exit(0)
}

// Chunk so we don't run the filter string toward Algolia's request-size limit.
const CHUNK = 100
let deletedCount = 0
let chunkIndex = 0
for (let i = 0; i < toDelete.length; i += CHUNK) {
  chunkIndex++
  const chunk = toDelete.slice(i, i + CHUNK)
  const filter = chunk.map(s => `shopDomain:"${s.slug}"`).join(' OR ')
  const body = { params: `filters=${encodeURIComponent(filter)}` }
  const res = await fetch(`${WRITE_HOST}/1/indexes/${INDEX}/deleteByQuery`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    console.error(`Chunk ${chunkIndex} failed: HTTP ${res.status} — ${(await res.text()).slice(0, 200)}`)
    process.exit(1)
  }
  const json = await res.json()
  const chunkRecords = chunk.reduce((a, s) => a + s.count, 0)
  deletedCount += chunkRecords
  console.log(`Chunk ${chunkIndex}: requested delete of ${chunk.length} shops / ${chunkRecords} records, taskID=${json.taskID}`)
}

console.log(`\nDeleted ${deletedCount} records across ${toDelete.length} shops.`)
console.log('Note: deleteByQuery is async on Algolia\'s side — the search index reflects the change within a few seconds.')
