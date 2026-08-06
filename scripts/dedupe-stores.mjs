#!/usr/bin/env node
// Reconcile `server/data/store-overrides.json` against the live Satsback
// catalog and resolve the duplicate slugs the colleague marks "DOPPELT".
//
//   pnpm stores:dedupe            # dry-run, prints the plan
//   pnpm stores:dedupe --apply    # rewrite store-overrides.json
//
// Always writes tmp/dedupe-plan.csv — hand that to the colleague so the
// Germany sheet gets the same corrections. The CSV is the source of truth
// for which slugs exist (sync-stores.mjs rebuilds from it), so `--apply`
// alone is temporary: the next `pnpm stores:sync` undoes it.
//
// Why this is mechanical rather than guesswork: the live catalog holds no
// duplicates at all — 873 stores, zero repeated names, images, descriptions
// or slug bases. What Satsback does is *rotate* a shop's numeric slug suffix
// over time (`sixt-6` became `sixt-2`, `getyourguide-14` became
// `getyourguide-8`; it moves in both directions, so it isn't a version
// counter). The spreadsheet keeps the old row and gains a new one, and the
// pair accumulates here. So for each family of slugs sharing a base, at most
// one member is live, and that member is the answer.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OVERRIDES_PATH = resolve(ROOT, 'server/data/store-overrides.json')
const TMP_DIR = resolve(ROOT, 'tmp')

// Slugs we inject ourselves in cachedStores() — Satsback won't return them.
const STATIC_SLUGS = new Set(['shopinbit'])

// The colleague uses the `url` column as a status flag as well as a URL
// ("DOPPELT", "ADDON", "nicht erreichbar", …). Those are notes, not links —
// `resolveFallbackUrl()` in ProductCard.vue would hand one straight to
// window.open(). Treat anything that isn't http(s) as "no URL recorded".
function isRealUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim())
}

function slugBase(slug) {
  return slug.replace(/-\d+$/, '')
}

const args = new Set(process.argv.slice(2))
const apply = args.has('--apply')

const overrides = JSON.parse(readFileSync(OVERRIDES_PATH, 'utf8'))

console.log('Fetching live Satsback store list for Germany…')
const liveStores = await fetch('https://satsback.com/api/v2/gospendl/stores/germany').then((r) => {
  if (!r.ok)
    throw new Error(`Satsback API ${r.status} ${r.statusText}`)
  return r.json()
})
const liveBySlug = new Map(liveStores.map(s => [s.slug, s]))
console.log(`  ${liveStores.length} live stores`)

// Group every slug we know about — from the overrides and from the live
// catalog — by its base, so a rotated pair lands in one family even when
// only one side is present in the overrides.
const families = new Map()
function family(base) {
  let f = families.get(base)
  if (!f) {
    f = { base, overrideSlugs: [], liveSlugs: [] }
    families.set(base, f)
  }
  return f
}
for (const slug of Object.keys(overrides)) {
  if (!STATIC_SLUGS.has(slug))
    family(slugBase(slug)).overrideSlugs.push(slug)
}
for (const slug of liveBySlug.keys())
  family(slugBase(slug)).liveSlugs.push(slug)

// How much curation an entry carries — used to pick which of a family's
// stale rows to fold onto the live slug. A real category and a search URL
// are the parts that took human effort.
function curationScore(slug) {
  const entry = overrides[slug]
  if (!entry)
    return -1
  const crawl = entry.crawl ?? {}
  return (entry.category && entry.category !== 'categories.other' ? 4 : 0)
    + (isRealUrl(entry.url) ? 2 : 0)
    + (crawl.searchUrl ? 2 : 0)
    + (crawl.schema ? 8 : 0)
    + (crawl.crawlable ? 1 : 0)
}

const merges = []
const delisted = []
const ambiguous = []

for (const f of families.values()) {
  // Nothing to reconcile: no override rows, or the single override row is
  // exactly the single live slug.
  if (f.overrideSlugs.length === 0)
    continue
  if (f.overrideSlugs.length === 1 && f.liveSlugs.length === 1 && f.overrideSlugs[0] === f.liveSlugs[0])
    continue

  if (f.liveSlugs.length > 1) {
    ambiguous.push(f)
    continue
  }
  if (f.liveSlugs.length === 0) {
    // The whole shop is gone from the catalog, not merely renamed.
    delisted.push(f)
    continue
  }

  const keep = f.liveSlugs[0]
  const drop = f.overrideSlugs.filter(s => s !== keep)
  if (drop.length === 0)
    continue

  // Fold the best-curated row onto the live slug, preferring whatever the
  // live row already has when it's genuinely populated.
  const donor = [...f.overrideSlugs].sort((a, b) => curationScore(b) - curationScore(a))[0]
  const kept = overrides[keep] ?? {}
  const from = overrides[donor] ?? {}
  // The donor is the highest-curated row in the family, which is `keep`
  // itself whenever the live row is the good one — so preferring the donor
  // throughout is not a bias against the live slug. It matters because the
  // rows marked "DOPPELT" tend to be the *live* ones, left with a sloppy
  // category while the real curation stayed on the row that has since
  // rotated out of the catalog (GetYourGuide sits under `categories.airline`
  // live, with `categories.travel` on the stale twin).
  const merged = {}
  const category = [from.category, kept.category].find(c => c && c !== 'categories.other')
  merged.category = category ?? 'categories.other'
  // When exactly one side says something other than `categories.other` the
  // choice is unambiguous. When both name a real category and they disagree,
  // nothing in the data says which is right — GetYourGuide is `airline` live
  // and `travel` on the twin (travel is right), but Coolblue is `electronics`
  // live and `marketplace` on the twin (electronics is right). Pick the
  // curated row so the output stays usable, and list it for a human to
  // confirm rather than pretending it was resolved.
  const bothReal = [kept.category, from.category].every(c => c && c !== 'categories.other')
  const categoryConflict = bothReal && kept.category !== from.category
    ? { keep, live: kept.category, twin: from.category, chosen: merged.category }
    : null
  const url = [from.url, kept.url].find(isRealUrl)
  if (url)
    merged.url = url
  const crawl = [from.crawl, kept.crawl].find(c => c?.searchUrl || c?.schema) ?? from.crawl ?? kept.crawl
  if (crawl)
    merged.crawl = crawl

  merges.push({ keep, drop, donor, merged, existed: keep in overrides, categoryConflict })
}

const sortByBase = (a, b) => a.base.localeCompare(b.base)
delisted.sort(sortByBase)
ambiguous.sort(sortByBase)
merges.sort((a, b) => a.keep.localeCompare(b.keep))

console.log(`\n${merges.length} duplicate famil${merges.length === 1 ? 'y' : 'ies'} resolvable automatically:`)
for (const m of merges) {
  const note = m.existed ? '' : '  (live slug had no override row at all)'
  console.log(`  keep ${m.keep}  ←  drop ${m.drop.join(', ')}${note}`)
  console.log(`       category=${m.merged.category} url=${m.merged.url ?? '—'} crawlable=${m.merged.crawl?.crawlable ?? false}`)
}

if (delisted.length) {
  console.log(`\n${delisted.length} famil${delisted.length === 1 ? 'y' : 'ies'} with no live slug — the shop is gone, not renamed:`)
  for (const f of delisted)
    console.log(`  ${f.overrideSlugs.join(', ')}`)
}

const categoryConflicts = merges.map(m => m.categoryConflict).filter(Boolean)
if (categoryConflicts.length) {
  console.log(`\n${categoryConflicts.length} merge(s) where both rows name a real category — confirm these:`)
  for (const c of categoryConflicts)
    console.log(`  ${c.keep.padEnd(20)} live says ${c.live}, twin says ${c.twin}  → using ${c.chosen}`)
}

if (ambiguous.length) {
  console.log(`\n⚠ ${ambiguous.length} famil${ambiguous.length === 1 ? 'y' : 'ies'} with more than one live slug — resolve by hand:`)
  for (const f of ambiguous)
    console.log(`  live: ${f.liveSlugs.join(', ')}   overrides: ${f.overrideSlugs.join(', ')}`)
}

// The plan the colleague actually needs: which spreadsheet rows to drop and
// which slug to keep, since the Germany sheet is what survives a re-sync.
mkdirSync(TMP_DIR, { recursive: true })
const csvRows = [['action', 'slug', 'keep_slug', 'reason']]
for (const m of merges) {
  for (const d of m.drop)
    csvRows.push(['delete row', d, m.keep, 'duplicate — slug rotated, this one is no longer in the Satsback catalog'])
  if (!m.existed)
    csvRows.push(['add row', m.keep, m.keep, `live slug missing from the sheet — carries the curation from ${m.donor}`])
}
for (const f of delisted) {
  for (const s of f.overrideSlugs)
    csvRows.push(['delisted', s, '', 'no live slug in this family — confirm with Satsback before removing'])
}
for (const c of categoryConflicts)
  csvRows.push(['check category', c.keep, c.keep, `live row says ${c.live}, duplicate says ${c.twin} — using ${c.chosen}, confirm which is right`])
const csvPath = resolve(TMP_DIR, 'dedupe-plan.csv')
const csvText = csvRows
  .map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(','))
  .join('\n')
writeFileSync(csvPath, `${csvText}\n`)
console.log(`\n✓ plan → tmp/dedupe-plan.csv (${csvRows.length - 1} rows)`)

if (!apply) {
  console.log('\nDry run — nothing written to store-overrides.json. Re-run with --apply to write.')
  console.log('Note: --apply is temporary. sync-stores.mjs rebuilds from the CSV, so the')
  console.log('Germany sheet needs the same corrections or the next stores:sync undoes them.')
}
else {
  for (const m of merges) {
    overrides[m.keep] = m.merged
    for (const d of m.drop)
      delete overrides[d]
  }
  const sorted = Object.fromEntries(Object.entries(overrides).sort(([a], [b]) => a.localeCompare(b)))
  writeFileSync(OVERRIDES_PATH, `${JSON.stringify(sorted, null, 2)}\n`)
  const dropped = merges.reduce((n, m) => n + m.drop.length, 0)
  console.log(`\n✓ merged ${merges.length} famil${merges.length === 1 ? 'y' : 'ies'}, removed ${dropped} duplicate entr${dropped === 1 ? 'y' : 'ies'} → store-overrides.json`)
}
