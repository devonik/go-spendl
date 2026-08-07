#!/usr/bin/env node
// Write the committed store/category data back out as the two CSVs that
// `pnpm stores:sync` consumes, so the spreadsheet can be refreshed from the
// repo instead of drifting away from it.
//
//   pnpm stores:export-csv
//
// Outputs (git-ignored):
//   tmp/categories-export.csv  — the Categories sheet
//   tmp/germany-export.csv     — the Germany sheet
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

function toCsv(rows) {
  return `${rows
    .map(row => row.map(cell => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(','))
    .join('\n')}\n`
}

const overrides = JSON.parse(readFileSync(OVERRIDES_PATH, 'utf8'))
const categories = JSON.parse(readFileSync(CATEGORIES_PATH, 'utf8'))

const storeRows = [STORE_HEADER]
let withCrawl = 0
for (const slug of Object.keys(overrides).sort((a, b) => a.localeCompare(b))) {
  const entry = overrides[slug]
  const crawl = entry.crawl
  if (crawl)
    withCrawl++
  storeRows.push([
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
  ])
}

const categoryRows = [CATEGORY_HEADER]
for (const category of categories)
  categoryRows.push([category.key, category.labelDe])

mkdirSync(TMP_DIR, { recursive: true })
writeFileSync(resolve(TMP_DIR, 'germany-export.csv'), toCsv(storeRows))
writeFileSync(resolve(TMP_DIR, 'categories-export.csv'), toCsv(categoryRows))

const withSchema = Object.values(overrides).filter(s => s.crawl?.schema).length
console.log(`✓ ${storeRows.length - 1} stores (${withCrawl} with crawl config) → tmp/germany-export.csv`)
console.log(`✓ ${categoryRows.length - 1} categories → tmp/categories-export.csv`)
console.log('\nHand both to the colleague, then re-import with:')
console.log('  pnpm stores:sync tmp/categories-export.csv tmp/germany-export.csv')
if (withSchema) {
  console.log(`\nNote: ${withSchema} crawl schema(s) are not in the CSV — no column can hold them.`)
  console.log('stores:sync re-merges those from store-overrides.json, so keep that file in place.')
}
