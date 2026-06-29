#!/usr/bin/env node
// Phase 1 of the crawl redesign: probe how many crawlable stores expose
// schema.org Product data via sitemap + JSON-LD. Reads no Algolia, writes
// nothing to the live system — output goes to ./tmp/probe/ for inspection.
//
//   pnpm probe:jsonld                  # default: 30 random stores, 5 samples each
//   pnpm probe:jsonld --limit 50
//   pnpm probe:jsonld --store baur     # probe a single store by slug
//   pnpm probe:jsonld --samples 3
//   pnpm probe:jsonld --with-crawl4ai  # fall back to Crawl4AI render when static fails
//
// CRAWL4AI_URL env var enables the JS-rendered fallback; without it the
// --with-crawl4ai flag is ignored.
//
// Per-store output:  ./tmp/probe/<slug>.json
// Aggregate summary: ./tmp/probe/_summary.json

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUT_DIR = resolve(ROOT, 'tmp/probe')
const OVERRIDES = resolve(ROOT, 'server/data/store-overrides.json')

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const FETCH_TIMEOUT_MS = 15000
const STORE_CONCURRENCY = 5

// ── args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
function flag(name, fallback) {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const ARG_LIMIT = Number(flag('limit', 30))
const ARG_SAMPLES = Number(flag('samples', 5))
const ARG_STORE = flag('store', null)
const ARG_WITH_CRAWL4AI = args.includes('--with-crawl4ai')
const CRAWL4AI_URL = process.env.CRAWL4AI_URL
const USE_CRAWL4AI = ARG_WITH_CRAWL4AI && !!CRAWL4AI_URL
if (ARG_WITH_CRAWL4AI && !CRAWL4AI_URL)
  console.warn('--with-crawl4ai given but CRAWL4AI_URL is not set; skipping fallback')

// ── store selection ─────────────────────────────────────────────────────
const overrides = JSON.parse(readFileSync(OVERRIDES, 'utf8'))
const allCrawlable = Object.entries(overrides)
  .filter(([, v]) => v.crawl?.crawlable === true)
  .map(([slug, v]) => ({ slug, url: v.url, searchUrl: v.crawl?.searchUrl }))

function deriveOrigin(store) {
  // Some overrides use placeholders like "ADDON" in the url field — fall
  // through to searchUrl when the primary value isn't a parseable URL.
  for (const candidate of [store.url, store.searchUrl]) {
    if (!candidate)
      continue
    try {
      return new URL(candidate).origin
    }
    catch {}
  }
  return null
}

let targets
if (ARG_STORE) {
  const found = allCrawlable.find(s => s.slug === ARG_STORE)
  if (!found) {
    console.error(`No crawlable store found with slug "${ARG_STORE}"`)
    process.exit(1)
  }
  targets = [found]
}
else {
  // Random sample for representativeness rather than alphabetical bias.
  const shuffled = [...allCrawlable].sort(() => Math.random() - 0.5)
  targets = shuffled.slice(0, ARG_LIMIT)
}

mkdirSync(OUT_DIR, { recursive: true })

// ── fetch helpers ───────────────────────────────────────────────────────
async function fetchWithTimeout(url, opts = {}) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, {
      ...opts,
      signal: ctrl.signal,
      headers: { 'User-Agent': USER_AGENT, ...(opts.headers || {}) },
      redirect: 'follow',
    })
  }
  finally {
    clearTimeout(t)
  }
}

async function fetchText(url) {
  const res = await fetchWithTimeout(url)
  if (!res.ok)
    throw new Error(`HTTP ${res.status}`)
  if (url.endsWith('.gz')) {
    const buf = Buffer.from(await res.arrayBuffer())
    return gunzipSync(buf).toString('utf8')
  }
  return await res.text()
}

// Crawl4AI sync render — used as a fallback when the static fetch returns no
// Product JSON-LD. Renders the page with a real browser so SPA-emitted
// structured data appears in the HTML we then parse.
async function fetchRenderedHtml(url) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 45000)
  try {
    const res = await fetch(`${CRAWL4AI_URL}/crawl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        urls: [url],
        browser_config: {
          type: 'BrowserConfig',
          params: {
            headless: true,
            viewport_width: 1900,
            viewport_height: 1200,
            headers: { 'User-Agent': USER_AGENT },
            // Stealth helps against shops with bot protection (douglas etc.).
            enable_stealth: true,
          },
        },
        crawler_config: {
          type: 'CrawlerRunConfig',
          params: {
            cache_mode: 2,
            wait_for_images: false,
            session_id: `probe-${Date.now()}`,
            exclude_all_images: true,
            page_timeout: 30000,
            delay_before_return_html: 1.5,
            simulate_user: true,
          },
        },
      }),
    })
    if (!res.ok)
      throw new Error(`Crawl4AI HTTP ${res.status}`)
    const json = await res.json()
    const html = json?.results?.[0]?.html
    if (!html)
      throw new Error('Crawl4AI returned no html')
    return html
  }
  finally {
    clearTimeout(t)
  }
}

// ── sitemap parsing ─────────────────────────────────────────────────────
function extractLocs(xml) {
  const out = []
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi
  let m
  while ((m = re.exec(xml)) !== null) out.push(m[1])
  return out
}

function isSitemapIndex(xml) {
  return /<sitemapindex[\s>]/i.test(xml)
}

async function discoverSitemapsFromRobots(origin) {
  try {
    const txt = await fetchText(`${origin}/robots.txt`)
    const out = []
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*sitemap\s*:\s*(\S+)/i)
      if (m)
        out.push(m[1])
    }
    return out
  }
  catch {
    return []
  }
}

async function discoverProductUrls(origin) {
  // Canonical discovery: robots.txt Sitemap: directives. Then fall back to
  // common conventional paths.
  const entryCandidates = [
    ...(await discoverSitemapsFromRobots(origin)),
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/sitemap.xml.gz`,
  ]
  let entryXml = null
  let entryUrl = null
  for (const path of entryCandidates) {
    try {
      entryXml = await fetchText(path)
      entryUrl = path
      break
    }
    catch {}
  }
  if (!entryXml)
    return { found: false, urls: [] }

  const urls = []
  if (isSitemapIndex(entryXml)) {
    // Prefer child sitemaps whose URL hints at products. Many shops split
    // their sitemap into product-sitemap.xml, category-sitemap.xml, etc. —
    // sampling from the product file dramatically lifts hit rate.
    const allChildren = extractLocs(entryXml)
    const productChildren = allChildren.filter(u => /product|artikel|item/i.test(u))
    const childSitemaps = (productChildren.length > 0 ? productChildren : allChildren).slice(0, 8)
    for (const child of childSitemaps) {
      try {
        const xml = await fetchText(child)
        urls.push(...extractLocs(xml))
      }
      catch {}
      if (urls.length > 500)
        break
    }
  }
  else {
    urls.push(...extractLocs(entryXml))
  }

  return { found: true, entryUrl, totalCollected: urls.length, urls }
}

// Heuristic: prefer URLs that look like product detail pages. Most product
// URLs have multiple path segments and a slug-shaped final segment. We can't
// be certain without fetching, so we just rank — the worst case is we sample
// a category page, which still tells us whether JSON-LD exists site-wide.
// Common non-product path tokens that pollute sitemaps. Strong negative signal.
const NON_PRODUCT_PATHS = /\/(blog|news|presse|press|magazin|magazine|article|articles|ratgeber|guide|guides|recipe|rezept|rezepte|jobs|career|careers|karriere|faq|help|hilfe|service|kontakt|contact|impressum|agb|datenschutz|privacy|about|ueber-uns|store-finder|filiale|filialen|category|kategorie|kategorien|c)\//i

function rankProductLikely(url) {
  try {
    const u = new URL(url)
    const segs = u.pathname.split('/').filter(Boolean)
    if (segs.length < 2)
      return -1
    if (NON_PRODUCT_PATHS.test(u.pathname))
      return -1
    const last = segs[segs.length - 1]
    let score = segs.length
    if (/-/.test(last))
      score += 2
    if (/\d/.test(last))
      score += 1
    if (/\.(html?|aspx?)$/i.test(last))
      score += 1
    if (/(product|p|artikel|item)/i.test(segs[segs.length - 2] || ''))
      score += 3
    return score
  }
  catch {
    return -1
  }
}

function pickProductSamples(urls, n) {
  const ranked = urls
    .map(u => ({ u, s: rankProductLikely(u) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s)
  // Spread the picks across the ranked list so we don't sample 5 sibling URLs
  const picks = []
  const stride = Math.max(1, Math.floor(ranked.length / n))
  for (let i = 0; i < ranked.length && picks.length < n; i += stride)
    picks.push(ranked[i].u)
  return picks
}

// ── JSON-LD extraction ──────────────────────────────────────────────────
function extractJsonLdBlocks(html) {
  const blocks = []
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m
  while ((m = re.exec(html)) !== null) {
    try {
      blocks.push(JSON.parse(m[1].trim()))
    }
    catch {
      // Some shops emit invalid JSON-LD (trailing commas, HTML-encoded entities).
      // Keep the raw string for inspection rather than dropping silently.
      blocks.push({ __parseError: true, raw: m[1].slice(0, 500) })
    }
  }
  return blocks
}

function collectTypes(blocks) {
  // Walk every JSON-LD node and record observed @type values. Useful for
  // diagnosing "site has JSON-LD but never Product" cases.
  const types = new Set()
  const visit = (node) => {
    if (!node || typeof node !== 'object')
      return
    if (Array.isArray(node)) {
      node.forEach(visit)
      return
    }
    const t = node['@type']
    if (typeof t === 'string')
      types.add(t)
    else if (Array.isArray(t))
      t.forEach(x => types.add(x))
    if (Array.isArray(node['@graph']))
      node['@graph'].forEach(visit)
  }
  blocks.forEach(visit)
  return [...types]
}

function findProductNode(blocks) {
  // schema.org Product can be: top-level object, inside an array, or inside
  // a @graph collection. Walk all forms.
  const visit = (node) => {
    if (!node || typeof node !== 'object')
      return null
    if (Array.isArray(node)) {
      for (const item of node) {
        const found = visit(item)
        if (found)
          return found
      }
      return null
    }
    const t = node['@type']
    // ProductGroup is the schema.org parent for products with variants — same
    // useful fields (name, brand, image, offers); accept both.
    const isProductLike = (x) => x === 'Product' || x === 'ProductGroup'
    if (typeof t === 'string' ? isProductLike(t) : (Array.isArray(t) && t.some(isProductLike)))
      return node
    if (Array.isArray(node['@graph'])) {
      for (const item of node['@graph']) {
        const found = visit(item)
        if (found)
          return found
      }
    }
    return null
  }
  for (const b of blocks) {
    const found = visit(b)
    if (found)
      return found
  }
  return null
}

// ── per-store probe ─────────────────────────────────────────────────────
async function probeStore(store) {
  const origin = deriveOrigin(store)
  const result = {
    slug: store.slug,
    origin,
    sitemap: { found: false },
    samples: [],
    summary: { attempted: 0, withProductJsonLd: 0, anyJsonLd: 0 },
    errors: [],
  }
  if (!origin) {
    result.errors.push('Could not derive origin from url/searchUrl')
    return result
  }

  try {
    const sm = await discoverProductUrls(origin)
    result.sitemap = { found: sm.found, entryUrl: sm.entryUrl, totalUrls: sm.totalCollected ?? 0 }
    if (!sm.found || sm.urls.length === 0) {
      result.errors.push('No sitemap found or empty')
      return result
    }
    const picks = pickProductSamples(sm.urls, ARG_SAMPLES)
    result.summary.attempted = picks.length

    const typesAcrossSamples = new Set()
    for (const url of picks) {
      const sample = { url, anyJsonLd: false, types: [], product: null, source: 'static' }
      try {
        const html = await fetchText(url)
        const blocks = extractJsonLdBlocks(html)
        sample.anyJsonLd = blocks.length > 0
        sample.types = collectTypes(blocks)
        const product = findProductNode(blocks)
        if (product)
          sample.product = product
      }
      catch (e) {
        sample.error = String(e.message || e)
      }

      // Fallback: render the page via Crawl4AI and re-parse. Only worth doing
      // when the static result had no Product — we're trying to lift SPA
      // shops into coverage, not re-confirm successes.
      if (USE_CRAWL4AI && !sample.product) {
        sample.crawl4aiAttempted = true
        try {
          const renderedHtml = await fetchRenderedHtml(url)
          sample.crawl4aiHtmlBytes = renderedHtml.length
          const renderedBlocks = extractJsonLdBlocks(renderedHtml)
          sample.crawl4aiBlocks = renderedBlocks.length
          const renderedTypes = collectTypes(renderedBlocks)
          renderedTypes.forEach(t => sample.types.includes(t) || sample.types.push(t))
          const renderedProduct = findProductNode(renderedBlocks)
          if (renderedProduct) {
            sample.product = renderedProduct
            sample.source = 'crawl4ai'
            sample.anyJsonLd = true
          }
          else if (renderedBlocks.length > 0) {
            sample.anyJsonLd = true
          }
        }
        catch (e) {
          sample.crawl4aiError = String(e.message || e)
        }
      }

      sample.types.forEach(t => typesAcrossSamples.add(t))
      if (sample.anyJsonLd)
        result.summary.anyJsonLd++
      if (sample.product) {
        result.summary.withProductJsonLd++
        if (sample.source === 'crawl4ai')
          result.summary.liftedByCrawl4ai = (result.summary.liftedByCrawl4ai || 0) + 1
      }
      result.samples.push(sample)
    }
    result.summary.observedTypes = [...typesAcrossSamples].sort()
  }
  catch (e) {
    result.errors.push(`Probe failed: ${e.message || e}`)
  }
  return result
}

// ── runner ──────────────────────────────────────────────────────────────
async function pool(items, n, worker) {
  const results = []
  let i = 0
  const workers = Array.from({ length: n }, async () => {
    while (i < items.length) {
      const idx = i++
      results[idx] = await worker(items[idx], idx)
    }
  })
  await Promise.all(workers)
  return results
}

console.log(`Probing ${targets.length} crawlable store(s), ${ARG_SAMPLES} sample(s) each…\n`)

const allResults = await pool(targets, STORE_CONCURRENCY, async (store, idx) => {
  const out = await probeStore(store)
  const lifted = out.summary.liftedByCrawl4ai
    ? ` (+${out.summary.liftedByCrawl4ai} via crawl4ai)`
    : ''
  const status = out.summary.withProductJsonLd > 0
    ? `✓ ${out.summary.withProductJsonLd}/${out.summary.attempted} Product JSON-LD${lifted}`
    : out.summary.anyJsonLd > 0
      ? `~ JSON-LD present, no Product type (${out.summary.anyJsonLd}/${out.summary.attempted})`
      : `✗ no JSON-LD (${out.errors.join('; ') || `0/${out.summary.attempted}`})`
  console.log(`[${idx + 1}/${targets.length}] ${store.slug.padEnd(30)} ${status}`)
  writeFileSync(resolve(OUT_DIR, `${store.slug}.json`), `${JSON.stringify(out, null, 2)}\n`)
  return out
})

// ── aggregate summary ───────────────────────────────────────────────────
const summary = {
  generatedAt: new Date().toISOString(),
  totalStoresProbed: allResults.length,
  samplesPerStore: ARG_SAMPLES,
  crawl4aiEnabled: USE_CRAWL4AI,
  storesWithSitemap: allResults.filter(r => r.sitemap.found).length,
  storesWithAnyProductJsonLd: allResults.filter(r => r.summary.withProductJsonLd > 0).length,
  storesWithAnyJsonLd: allResults.filter(r => r.summary.anyJsonLd > 0).length,
  fullCoverageStores: allResults.filter(r => r.summary.attempted > 0 && r.summary.withProductJsonLd === r.summary.attempted).length,
  storesLiftedByCrawl4ai: allResults.filter(r => (r.summary.liftedByCrawl4ai || 0) > 0).length,
  byStore: allResults.map(r => ({
    slug: r.slug,
    sitemap: r.sitemap.found,
    attempted: r.summary.attempted,
    withProduct: r.summary.withProductJsonLd,
    anyJsonLd: r.summary.anyJsonLd,
    liftedByCrawl4ai: r.summary.liftedByCrawl4ai || 0,
  })),
}
writeFileSync(resolve(OUT_DIR, '_summary.json'), `${JSON.stringify(summary, null, 2)}\n`)

const pct = (n, total) => total === 0 ? '0%' : `${Math.round((n / total) * 100)}%`
console.log(`\n── Summary ──`)
console.log(`Sitemap found:           ${summary.storesWithSitemap}/${summary.totalStoresProbed} (${pct(summary.storesWithSitemap, summary.totalStoresProbed)})`)
console.log(`Product JSON-LD (any):   ${summary.storesWithAnyProductJsonLd}/${summary.totalStoresProbed} (${pct(summary.storesWithAnyProductJsonLd, summary.totalStoresProbed)})`)
console.log(`Product JSON-LD (full):  ${summary.fullCoverageStores}/${summary.totalStoresProbed} (${pct(summary.fullCoverageStores, summary.totalStoresProbed)})`)
if (USE_CRAWL4AI)
  console.log(`Lifted by Crawl4AI:      ${summary.storesLiftedByCrawl4ai}/${summary.totalStoresProbed} (${pct(summary.storesLiftedByCrawl4ai, summary.totalStoresProbed)})`)
console.log(`\nDetails: ${OUT_DIR}/`)
