#!/usr/bin/env node
// Write the committed store/category data back out as the two CSVs that
// `pnpm stores:sync` consumes, so the spreadsheet can be refreshed from the
// repo instead of drifting away from it.
//
//   pnpm stores:export-csv                       # overrides only, offline
//   pnpm stores:export-csv --include-uncovered   # + live stores we don't curate
//
// Outputs (git-ignored):
//   tmp/categories-export.csv  — the Categories sheet
//   tmp/germany-export.csv     — the Germany sheet
//
// `--include-uncovered` fetches the live Satsback catalog and adds a blank
// row for every store that has no override. Without it those stores can
// never be curated: they're live and payable but `extendStores()` defaults
// them to `categories.other`, so they vanish from the category filter — and
// an overrides-driven export can't surface a store that has no override, so
// the sheet never learns they exist. The mode adds two informational
// columns, `name` and `status`; sync-stores.mjs indexes columns by header
// name and so ignores both, and a blank `category` re-imports as
// `categories.other` — the same value those stores already have. So the
// round trip stays lossless either way.
//
// Why this exists: the Satsback API carries no category, URL or crawl
// metadata, so the spreadsheet is the origin of ~2500 hand-curated values
// and can't simply be retired. But with the sheet as the only source and
// the repo as a one-way copy, every fix applied here — a dedupe, a
// disable, a corrected category — had to be replayed by hand in Excel or
// it was undone by the next sync. Exporting closes the loop: hand over a
// sheet that already contains the corrections, let the colleague edit
// their columns, sync back.
//
// The round trip is lossless for everything the CSV can express. Crawl
// schemas have no column and never survive a CSV hop — sync-stores.mjs
// re-merges those from the existing store-overrides.json instead.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OVERRIDES_PATH = resolve(ROOT, 'server/data/store-overrides.json')
const CATEGORIES_PATH = resolve(ROOT, 'server/data/categories.json')
const TMP_DIR = resolve(ROOT, 'tmp')

// Header names must match what sync-stores.mjs indexes by, or a re-import
// silently drops the column.
const STORE_HEADER = ['slug', 'category', 'url', 'note', 'search url', 'CMS', 'crawlable', 'comment']
const CATEGORY_HEADER = ['i18nKey - DO NOT TOUCH', 'Category Name']
// Appended only in --include-uncovered mode. Purely for the human reading the
// sheet: 122 unfamiliar slugs are hard to categorise without the shop name,
// and `status` lets the colleague filter the new rows out of ~870. Neither is
// in sync-stores.mjs's header index, so neither comes back into the data.
const EXTRA_HEADER = ['name', 'status']

const args = new Set(process.argv.slice(2))
const includeUncovered = args.has('--include-uncovered')

function toCsv(rows) {
  return `${rows
    .map(row => row.map(cell => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(','))
    .join('\n')}\n`
}

const overrides = JSON.parse(readFileSync(OVERRIDES_PATH, 'utf8'))
const categories = JSON.parse(readFileSync(CATEGORIES_PATH, 'utf8'))

// Slugs we inject ourselves in cachedStores() — Satsback won't return them,
// so they must not be mistaken for a store that went missing.
const STATIC_SLUGS = new Set(['shopinbit'])

const liveNames = new Map()
let uncoveredSlugs = []
if (includeUncovered) {
  console.log('Fetching live Satsback store list for Germany…')
  const liveStores = await fetch('https://satsback.com/api/v2/gospendl/stores/germany').then((r) => {
    if (!r.ok)
      throw new Error(`Satsback API ${r.status} ${r.statusText}`)
    return r.json()
  })
  console.log(`  ${liveStores.length} live stores`)
  for (const store of liveStores)
    liveNames.set(store.slug, store.name ?? '')
  uncoveredSlugs = liveStores
    .map(s => s.slug)
    .filter(slug => !(slug in overrides) && !STATIC_SLUGS.has(slug))
  console.log(`  ${uncoveredSlugs.length} live store(s) with no override\n`)
}

// Interleave the uncovered rows rather than appending them, so the sheet stays
// sorted by slug and successive exports produce a stable diff. The `status`
// column is how the colleague finds them.
const allSlugs = [...new Set([...Object.keys(overrides), ...uncoveredSlugs])]
  .sort((a, b) => a.localeCompare(b))

const storeRows = [includeUncovered ? [...STORE_HEADER, ...EXTRA_HEADER] : STORE_HEADER]
let withCrawl = 0
for (const slug of allSlugs) {
  // Uncovered stores have no entry at all — every curated column stays blank
  // for the colleague to fill in.
  const entry = overrides[slug] ?? {}
  const crawl = entry.crawl
  if (crawl)
    withCrawl++
  const row = [
    slug,
    entry.category ?? '',
    entry.url ?? '',
    entry.note ?? '',
    crawl?.searchUrl ?? '',
    crawl?.cms ?? '',
    // Only emit TRUE/FALSE for stores that actually have a crawl block —
    // an empty value is how sync-stores.mjs decides not to create one.
    crawl ? (crawl.crawlable ? 'TRUE' : 'FALSE') : '',
    crawl?.comment ?? '',
  ]
  if (includeUncovered)
    row.push(liveNames.get(slug) ?? '', slug in overrides ? '' : 'NEU')
  storeRows.push(row)
}

const categoryRows = [CATEGORY_HEADER]
for (const category of categories)
  categoryRows.push([category.key, category.labelDe])

mkdirSync(TMP_DIR, { recursive: true })
writeFileSync(resolve(TMP_DIR, 'germany-export.csv'), toCsv(storeRows))
writeFileSync(resolve(TMP_DIR, 'categories-export.csv'), toCsv(categoryRows))

const withSchema = Object.values(overrides).filter(s => s.crawl?.schema).length
const uncoveredNote = includeUncovered ? `, ${uncoveredSlugs.length} marked NEU` : ''
console.log(`✓ ${storeRows.length - 1} stores (${withCrawl} with crawl config${uncoveredNote}) → tmp/germany-export.csv`)
console.log(`✓ ${categoryRows.length - 1} categories → tmp/categories-export.csv`)
console.log('\nHand both to the colleague, then re-import with:')
console.log('  pnpm stores:sync tmp/categories-export.csv tmp/germany-export.csv')
if (includeUncovered && uncoveredSlugs.length) {
  console.log(`\n${uncoveredSlugs.length} row(s) have status=NEU and a blank category — those are the`)
  console.log('live stores nobody has curated yet. Until a category is filled in they')
  console.log('re-import as categories.other, exactly what they resolve to today.')
}
else if (!includeUncovered) {
  console.log('\nNote: this export covers the overrides only. Re-run with --include-uncovered')
  console.log('to add live stores that have no override row — the sheet cannot otherwise')
  console.log('learn they exist, and they stay stuck on categories.other.')
}
if (withSchema) {
  console.log(`\nNote: ${withSchema} crawl schema(s) are not in the CSV — no column can hold them.`)
  console.log('stores:sync re-merges those from store-overrides.json, so keep that file in place.')
}
