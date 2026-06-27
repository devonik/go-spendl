#!/usr/bin/env node
// Find stores in `server/data/store-overrides.json` that are marked
// `crawl.crawlable: true` but no longer appear in the live Satsback
// catalog. By default we just print the diff (dry-run). Pass `--apply`
// to actually flip `crawlable: false` and append a comment.
//
//   pnpm stores:disable-missing            # dry-run, prints the list
//   pnpm stores:disable-missing --apply    # writes changes + snapshot
//
// Always writes a snapshot of the missing list to tmp/ so you can
// review it without re-running the network call.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OVERRIDES_PATH = resolve(ROOT, 'server/data/store-overrides.json')

// Slugs we inject ourselves in cachedStores() — Satsback won't return them.
const STATIC_SLUGS = new Set(['shopinbit'])

const args = new Set(process.argv.slice(2))
const apply = args.has('--apply')
const today = new Date().toISOString().slice(0, 10)

const overrides = JSON.parse(readFileSync(OVERRIDES_PATH, 'utf8'))

console.log('Fetching live Satsback store list for Germany…')
const liveStores = await fetch('https://satsback.com/api/v2/gospendl/stores/germany').then((r) => {
  if (!r.ok)
    throw new Error(`Satsback API ${r.status} ${r.statusText}`)
  return r.json()
})
const liveSlugs = new Set(liveStores.map(s => s.slug))
console.log(`  ${liveStores.length} live stores`)

const crawlable = Object.entries(overrides).filter(([, s]) => s.crawl?.crawlable)
const missing = []
for (const [slug] of crawlable) {
  if (STATIC_SLUGS.has(slug)) continue
  if (liveSlugs.has(slug)) continue
  missing.push(slug)
}
console.log(`  ${crawlable.length} crawlable overrides, ${missing.length} no longer in Satsback\n`)

// Always save a snapshot so the user has the raw list for spot-checking.
const tmpDir = resolve(ROOT, 'tmp')
mkdirSync(tmpDir, { recursive: true })
const snapshotPath = resolve(tmpDir, `missing-stores-${today}.json`)
writeFileSync(snapshotPath, `${JSON.stringify({ checkedAt: new Date().toISOString(), missing }, null, 2)}\n`)
console.log(`Snapshot: ${snapshotPath}\n`)

if (missing.length === 0) {
  console.log('Nothing to do — all crawlable overrides are in the live catalog.')
  process.exit(0)
}

if (!apply) {
  console.log('Missing slugs (dry-run, no changes written):')
  for (const slug of missing) {
    const meta = overrides[slug]
    const category = meta?.category ?? '?'
    const url = meta?.url ?? meta?.crawl?.searchUrl ?? ''
    console.log(`  - ${slug.padEnd(38, ' ')} ${category.padEnd(24, ' ')} ${url}`)
  }
  console.log(`\nRun with --apply to flip crawlable: false on these ${missing.length} stores.`)
  process.exit(0)
}

const note = `auto-disabled ${today}: not in Satsback catalog`
for (const slug of missing) {
  const store = overrides[slug]
  store.crawl = store.crawl || {}
  store.crawl.crawlable = false
  store.crawl.comment = store.crawl.comment ? `${store.crawl.comment} | ${note}` : note
}
writeFileSync(OVERRIDES_PATH, `${JSON.stringify(overrides, null, 2)}\n`)
console.log(`Updated ${missing.length} stores in ${OVERRIDES_PATH}`)
console.log('Commit the change and redeploy.')
