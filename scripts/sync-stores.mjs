#!/usr/bin/env node
// Regenerates committed store/category data from two CSV exports of the
// Satsback stores Excel sheet. Run when the colleague ships a new Excel:
//
//   pnpm stores:sync <categories.csv> <germany.csv>
//
// Outputs:
//   server/data/categories.json       — [{ key, labelDe, labelEn }]
//   server/data/store-overrides.json  — { [slug]: { category, url?, crawl? } }
//   i18n/locales/categories.de.json   — { [keyTail]: labelDe }
//   i18n/locales/categories.en.json   — { [keyTail]: labelEn }
//
// Re-running preserves existing labelEn from categories.json; new categories
// fall back to SEED_EN below, so add entries there before running.
//
// It also preserves the parts of `crawl` that the CSV cannot express —
// `schema`, `paging`, `sampleQuery`, `emptyResultStatus` — by reading the
// current store-overrides.json back in and re-merging them per slug. Those
// are produced by `pnpm gen:schema` / `pnpm save:schema` and by hand, never
// by the colleague's spreadsheet, so rebuilding purely from the CSV used to
// drop every one of them on the floor.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// Spelling + duplicate resolution. Applied to every i18n key we encounter —
// both in the Categories sheet and in the per-store `category` column.
const KEY_FIXES = {
  'categories.pharmacys': 'categories.pharmacy',
  'categories.bikecycle': 'categories.bicycles',
  'categories.musik': 'categories.music',
  'categories.jewlerie': 'categories.jewelry',
  'categories.insurence': 'categories.insurance',
  'categories.bedding': 'categories.household',
  'categorries.beauty': 'categories.beauty',
}

// English labels for categories that don't yet have one in categories.json.
// Preserved across reruns once written.
const SEED_EN = {
  'categories.airline': 'Airline',
  'categories.hotels': 'Hotels',
  'categories.accommodation': 'Accommodation',
  'categories.travel': 'Travel',
  'categories.activities': 'Activities',
  'categories.security': 'Security',
  'categories.software': 'Software',
  'categories.esim': 'eSIM',
  'categories.telecom': 'Telecom',
  'categories.energy': 'Energy',
  'categories.marketplace': 'Marketplace',
  'categories.retail': 'Retail',
  'categories.fashion': 'Fashion',
  'categories.sportswear': 'Sportswear',
  'categories.sneakers': 'Sneakers',
  'categories.lifestyle': 'Lifestyle',
  'categories.food': 'Food',
  'categories.spices': 'Spices',
  'categories.wine': 'Wine',
  'categories.household': 'Household',
  'categories.appliances': 'Appliances',
  'categories.furniture': 'Furniture',
  'categories.materials': 'Materials',
  'categories.automotive': 'Automotive',
  'categories.electronics': 'Electronics',
  'categories.3dprinting': '3D Printing',
  'categories.pharmacy': 'Pharmacy',
  'categories.cosmetics': 'Cosmetics',
  'categories.fitness': 'Fitness',
  'categories.pets': 'Pets',
  'categories.education': 'Education',
  'categories.books': 'Books',
  'categories.photography': 'Photography',
  'categories.other': 'Other',
  'categories.office': 'Office',
  'categories.shoes': 'Shoes',
  'categories.supplements': 'Supplements',
  'categories.streaming': 'Streaming',
  'categories.outdoor': 'Outdoor',
  'categories.bicycles': 'Bicycles',
  'categories.baby': 'Baby',
  'categories.music': 'Music',
  'categories.beauty': 'Beauty',
  'categories.garden': 'Garden',
  'categories.beer': 'Beer',
  'categories.finance': 'Finance',
  'categories.gaming': 'Gaming',
  'categories.jewelry': 'Jewelry',
  'categories.insurance': 'Insurance',
  'categories.art': 'Art',
  'categories.coffee': 'Coffee',
  'categories.doctor': 'Online Doctors',
  'categories.casino': 'Casino',
  'categories.lottery': 'Lottery',
}

// German fallbacks for rows where the Category Name cell is empty or misspelled.
const SEED_DE = {
  'categories.beauty': 'Beauty',
  'categories.coffee': 'Kaffee',
}

function parseCSV(text) {
  const rows = []
  let cur = ['']
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        cur[cur.length - 1] += '"'
        i++
      }
      else if (ch === '"') { inQuotes = false }
      else { cur[cur.length - 1] += ch }
    }
    else {
      if (ch === '"') { inQuotes = true }
      else if (ch === ',') { cur.push('') }
      else if (ch === '\n') { rows.push(cur); cur = [''] }
      else if (ch === '\r') { /* skip */ }
      else { cur[cur.length - 1] += ch }
    }
  }
  if (cur.length > 1 || cur[0] !== '')
    rows.push(cur)
  return rows
}

const cap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
// Only title-case all-lowercase labels. Preserves intentional casing like
// "3D-Druck", "eSIM", "B2B".
function normalizeLabel(s) {
  if (!s)
    return s
  if (/[A-Z]/.test(s))
    return s
  return s.split(' ').map(cap).join(' ')
}
const normalizeKey = key => KEY_FIXES[key] ?? key

const [, , categoriesPath, storesPath] = process.argv
if (!categoriesPath || !storesPath) {
  console.error('Usage: pnpm stores:sync <categories.csv> <germany.csv>')
  process.exit(1)
}

const outDir = resolve(ROOT, 'server/data')
mkdirSync(outDir, { recursive: true })
const categoriesOut = resolve(outDir, 'categories.json')
const overridesOut = resolve(outDir, 'store-overrides.json')
const i18nDir = resolve(ROOT, 'i18n/locales')

let existingByKey = {}
if (existsSync(categoriesOut)) {
  const existing = JSON.parse(readFileSync(categoriesOut, 'utf8'))
  existingByKey = Object.fromEntries(existing.map(c => [c.key, c]))
}

// ── Categories ──────────────────────────────────────────────────────────
const catRows = parseCSV(readFileSync(categoriesPath, 'utf8'))
const [catHeader, ...catData] = catRows
const catIdx = Object.fromEntries(catHeader.map((h, i) => [h.trim(), i]))

const allCategories = []
const seen = new Set()
for (const row of catData) {
  const keyRaw = row[catIdx['i18nKey - DO NOT TOUCH']]?.trim()
  if (!keyRaw)
    continue
  const key = normalizeKey(keyRaw)
  if (seen.has(key))
    continue
  seen.add(key)

  const labelDeRaw = row[catIdx['Category Name']]?.trim() ?? ''
  const existing = existingByKey[key]
  const labelDe = SEED_DE[key] || normalizeLabel(labelDeRaw) || existing?.labelDe || normalizeLabel(key.replace('categories.', ''))
  const labelEn = existing?.labelEn || SEED_EN[key] || normalizeLabel(key.replace('categories.', ''))

  allCategories.push({ key, labelDe, labelEn })
}

if (!seen.has('categories.other')) {
  allCategories.push({ key: 'categories.other', labelDe: 'Sonstiges', labelEn: 'Other' })
}

const knownKeys = new Set(allCategories.map(c => c.key))

// ── Store overrides ─────────────────────────────────────────────────────
const storeRows = parseCSV(readFileSync(storesPath, 'utf8'))
const [storeHeader, ...storeData] = storeRows
const sIdx = Object.fromEntries(storeHeader.map((h, i) => [h.trim(), i]))

// Crawl keys that only ever come from the generator or from hand-editing.
// The CSV owns searchUrl/cms/crawlable/comment; everything here survives a
// re-sync untouched. Ordered to match how the file already reads — the bulky
// `schema` last — so re-syncing doesn't churn the diff.
const PRESERVED_CRAWL_KEYS = ['emptyResultStatus', 'sampleQuery', 'paging', 'schema']

let existingOverrides = {}
if (existsSync(overridesOut)) {
  existingOverrides = JSON.parse(readFileSync(overridesOut, 'utf8'))
}

function isRealUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim())
}

function preservedCrawlFor(slug) {
  const crawl = existingOverrides[slug]?.crawl
  if (!crawl)
    return {}
  const kept = {}
  for (const key of PRESERVED_CRAWL_KEYS) {
    if (crawl[key] !== undefined)
      kept[key] = crawl[key]
  }
  return kept
}

const overrides = {}
const referencedCategories = new Set()
let unknown = 0
let total = 0
let preservedCount = 0
let noteCount = 0
let salvagedNoteCount = 0
for (const row of storeData) {
  const slug = row[sIdx.slug]?.trim()
  if (!slug)
    continue
  total++

  const rawCat = row[sIdx.category]?.trim()
  const fixedCat = rawCat ? normalizeKey(rawCat) : ''
  let category = 'categories.other'
  if (fixedCat && knownKeys.has(fixedCat)) {
    category = fixedCat
  }
  else if (rawCat) {
    console.warn(`⚠ Unknown category "${rawCat}" on "${slug}" → categories.other`)
    unknown++
  }
  referencedCategories.add(category)

  const urlRaw = row[sIdx.url]?.trim()
  // The URL column doubles as a status field in the spreadsheet: "ADDON" (the
  // Satsback browser extension doesn't trigger on this shop), "DOPPELT" (a
  // duplicate of another slug), "nicht erreichbar", and so on. Those are notes,
  // not links, and `url` is consumed as one — resolveFallbackUrl() in
  // ProductCard.vue hands it straight to window.open(), which would resolve
  // "ADDON" against our own origin. Keep `url` strictly a URL and park anything
  // else in `note` so the colleague's annotation survives the round trip.
  // A dedicated `note` column takes precedence when the sheet has one — that
  // is what `pnpm stores:export-csv` writes, so a sheet that came from an
  // export keeps notes and URLs properly separated instead of relying on the
  // fallback below.
  const url = isRealUrl(urlRaw) ? urlRaw : undefined
  const noteColumn = sIdx.note === undefined ? undefined : row[sIdx.note]?.trim()
  const salvagedNote = !url && urlRaw ? urlRaw : undefined
  const note = noteColumn || salvagedNote
  if (note)
    noteCount++
  // Counted separately so the summary can say whether the sheet still needs
  // the fallback, or has grown a proper `note` column.
  if (!noteColumn && salvagedNote)
    salvagedNoteCount++
  const searchUrl = row[sIdx['search url']]?.trim()
  const cms = row[sIdx.CMS]?.trim()
  const crawlableRaw = row[sIdx.crawlable]?.trim().toUpperCase()
  const comment = row[sIdx.comment]?.trim()

  // Carried over from the current file — the CSV has no column for any of it.
  const preservedCrawl = preservedCrawlFor(slug)
  const hasPreserved = Object.keys(preservedCrawl).length > 0
  if (hasPreserved)
    preservedCount++

  // A store that has preserved metadata still needs its `crawl` block even
  // when the CSV row carries none of the crawl columns — otherwise the block
  // is dropped and the schema goes with it.
  const hasCrawl = searchUrl || cms || crawlableRaw === 'TRUE' || crawlableRaw === 'FALSE' || comment
  const crawl = (hasCrawl || hasPreserved)
    ? {
        searchUrl: searchUrl || '',
        cms: cms || '',
        crawlable: crawlableRaw === 'TRUE',
        ...(comment ? { comment } : {}),
        ...preservedCrawl,
      }
    : undefined

  overrides[slug] = {
    category,
    ...(url ? { url } : {}),
    ...(note ? { note } : {}),
    ...(crawl ? { crawl } : {}),
  }
}

const sortedOverrides = Object.fromEntries(
  Object.entries(overrides).sort(([a], [b]) => a.localeCompare(b)),
)
writeFileSync(overridesOut, `${JSON.stringify(sortedOverrides, null, 2)}\n`)

// ── Prune unreferenced categories ───────────────────────────────────────
// categories.other stays as the fallback target even if no store uses it.
referencedCategories.add('categories.other')
const unused = allCategories.filter(c => !referencedCategories.has(c.key)).map(c => c.key)
const categories = allCategories
  .filter(c => referencedCategories.has(c.key))
  .sort((a, b) => a.key.localeCompare(b.key))

writeFileSync(categoriesOut, `${JSON.stringify(categories, null, 2)}\n`)
const i18nDe = Object.fromEntries(categories.map(c => [c.key.replace('categories.', ''), c.labelDe]))
const i18nEn = Object.fromEntries(categories.map(c => [c.key.replace('categories.', ''), c.labelEn]))
writeFileSync(resolve(i18nDir, 'categories.de.json'), `${JSON.stringify(i18nDe, null, 2)}\n`)
writeFileSync(resolve(i18nDir, 'categories.en.json'), `${JSON.stringify(i18nEn, null, 2)}\n`)

// The CSV stays the authority on which stores exist, so a slug it no longer
// lists is still dropped — but dropping one that carried a generated schema
// throws away real crawl work, and silently doing that is how it would go
// unnoticed until the next crawl run came back empty.
const droppedWithCrawlMeta = Object.keys(existingOverrides).filter(
  slug => !(slug in overrides) && Object.keys(preservedCrawlFor(slug)).length > 0,
)

console.log(`✓ ${categories.length} categories → server/data/categories.json`)
console.log(`✓ ${Object.keys(sortedOverrides).length}/${total} store overrides → server/data/store-overrides.json`)
console.log(`✓ ${preservedCount} stores kept their generated crawl metadata (${PRESERVED_CRAWL_KEYS.join(', ')})`)
if (noteCount) {
  console.log(`✓ ${noteCount} store note(s) recorded (ADDON, DOPPELT, …)`)
  if (salvagedNoteCount) {
    console.log(`   ${salvagedNoteCount} of them came from non-URL values in the URL column —`)
    console.log(`   \`pnpm stores:export-csv\` writes a dedicated \`note\` column to retire that fallback.`)
  }
}
console.log(`✓ i18n locales → i18n/locales/categories.{de,en}.json`)
if (unknown)
  console.warn(`⚠ ${unknown} stores defaulted to categories.other (unknown category key)`)
if (unused.length) {
  console.warn(`⚠ ${unused.length} categories pruned (no stores reference them):`)
  unused.forEach(k => console.warn(`   - ${k}`))
  console.warn(`   → Remove them from the Categories sheet to keep both in sync.`)
}
if (droppedWithCrawlMeta.length) {
  console.warn(`⚠ ${droppedWithCrawlMeta.length} store(s) with generated crawl metadata are not in the CSV and were dropped:`)
  droppedWithCrawlMeta.forEach(k => console.warn(`   - ${k}`))
  console.warn(`   → Their schemas are gone from store-overrides.json. Restore via git, or`)
  console.warn(`     re-add the slug to the Germany sheet if the store should still be crawled.`)
}
