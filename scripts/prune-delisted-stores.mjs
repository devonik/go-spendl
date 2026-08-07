#!/usr/bin/env node
// Remove override rows for shops Satsback no longer lists at all.
//
//   pnpm stores:prune-delisted            # dry-run, prints the plan
//   pnpm stores:prune-delisted --apply    # rewrite store-overrides.json
//
// Always writes tmp/delisted-plan.csv for the colleague and a full
// tmp/delisted-stores-<date>.json snapshot of every entry it removes, so
// the curation is recoverable without digging through git history.
//
// This is the other half of `pnpm stores:dedupe`. Dedupe handles slugs that
// *rotated* — the shop is still live under a new suffix, so its curation gets
// folded onto the live slug. This handles the families where no member is
// live: the shop is gone, and the row is a key in a lookup map that nothing
// ever reads. `extendStores()` maps over the live catalog and reads
// `storeOverrides[store.slug]`, so a stale key has no effect on the app —
// which is exactly why it accumulates silently.
//
// The script refuses to touch a slug whose family has any live member. That
// case is a rename, and deleting it would throw away curation that dedupe
// would have preserved.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OVERRIDES_PATH = resolve(ROOT, 'server/data/store-overrides.json')
const TMP_DIR = resolve(ROOT, 'tmp')

// Slugs we inject ourselves in cachedStores() — Satsback won't return them.
const STATIC_SLUGS = new Set(['shopinbit'])

function slugBase(slug) {
  return slug.replace(/-\d+$/, '')
}

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

// Index live slugs by base so a rotation is detectable — those belong to
// dedupe, not here.
const liveBases = new Set([...liveSlugs].map(slugBase))

const delisted = []
const rotated = []
for (const slug of Object.keys(overrides)) {
  if (STATIC_SLUGS.has(slug) || liveSlugs.has(slug))
    continue
  if (liveBases.has(slugBase(slug)))
    rotated.push(slug)
  else
    delisted.push(slug)
}
delisted.sort()
rotated.sort()

console.log(`  ${Object.keys(overrides).length} overrides, ${delisted.length} with no live shop behind them\n`)

if (rotated.length) {
  // Not an error — just not this script's job, and silently skipping them
  // would look like the prune had missed something.
  console.log(`${rotated.length} stale slug(s) have a live shop under a rotated suffix — run pnpm stores:dedupe for those:`)
  for (const slug of rotated)
    console.log(`  ${slug} → ${[...liveSlugs].filter(s => slugBase(s) === slugBase(slug)).join(', ')}`)
  console.log('')
}

if (delisted.length === 0) {
  console.log('Nothing to prune — every override matches a live store.')
  process.exit(0)
}

// Flag the entries where removal discards real work, so a schema that took a
// generator run and a validation pass doesn't vanish unnoticed.
const withSchema = delisted.filter(s => overrides[s].crawl?.schema)
const withSearchUrl = delisted.filter(s => overrides[s].crawl?.searchUrl)
const stillCrawlable = delisted.filter(s => overrides[s].crawl?.crawlable)

console.log('Delisted slugs (no live match, no rotation candidate):')
for (const slug of delisted) {
  const entry = overrides[slug]
  const marks = [
    entry.crawl?.schema ? 'schema' : '',
    entry.crawl?.crawlable ? 'crawlable' : '',
  ].filter(Boolean).join(',')
  console.log(`  ${slug.padEnd(38, ' ')} ${(entry.category ?? '?').padEnd(24, ' ')} ${marks}`)
}

console.log(`\n  ${withSearchUrl.length} carry a searchUrl, ${withSchema.length} carry a generated schema, ${stillCrawlable.length} are still crawlable`)
if (withSchema.length) {
  console.log(`  ⚠ schema(s) discarded: ${withSchema.join(', ')}`)
  console.log('    Regenerating one costs a pnpm gen:schema run — confirm the shop is really gone.')
}

mkdirSync(TMP_DIR, { recursive: true })

// Full snapshot of what gets removed, so nothing is only recoverable via git.
const snapshotPath = resolve(TMP_DIR, `delisted-stores-${today}.json`)
writeFileSync(snapshotPath, `${JSON.stringify({
  checkedAt: new Date().toISOString(),
  liveStoreCount: liveStores.length,
  removed: Object.fromEntries(delisted.map(s => [s, overrides[s]])),
}, null, 2)}\n`)
console.log(`\n✓ snapshot → tmp/${snapshotPath.split('/').pop()} (${delisted.length} entries, full curation)`)

// The plan the colleague needs: the Germany sheet is what survives a re-sync,
// so these rows have to come out of it too or the next stores:sync restores
// every one of them.
const csvRows = [['action', 'slug', 'category', 'note', 'reason']]
for (const slug of delisted) {
  const entry = overrides[slug]
  csvRows.push([
    'delete row',
    slug,
    entry.category ?? '',
    entry.note ?? '',
    'not in the Satsback catalog under this or any rotated slug — confirm delisted',
  ])
}
const csvPath = resolve(TMP_DIR, 'delisted-plan.csv')
writeFileSync(csvPath, `${csvRows
  .map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(','))
  .join('\n')}\n`)
console.log(`✓ plan → tmp/delisted-plan.csv (${csvRows.length - 1} rows)`)

if (!apply) {
  console.log(`\nDry run — nothing written to store-overrides.json. Re-run with --apply to remove these ${delisted.length} entries.`)
  console.log('Note: --apply is temporary. sync-stores.mjs rebuilds from the CSV, so the')
  console.log('Germany sheet needs the same deletions or the next stores:sync restores them.')
}
else {
  for (const slug of delisted)
    delete overrides[slug]
  const sorted = Object.fromEntries(Object.entries(overrides).sort(([a], [b]) => a.localeCompare(b)))
  writeFileSync(OVERRIDES_PATH, `${JSON.stringify(sorted, null, 2)}\n`)
  console.log(`\n✓ removed ${delisted.length} delisted entr${delisted.length === 1 ? 'y' : 'ies'} → store-overrides.json (${Object.keys(sorted).length} remain)`)
  console.log('Next: pnpm stores:export-csv, then send the sheet + tmp/delisted-plan.csv to the colleague.')
}
