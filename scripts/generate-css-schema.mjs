#!/usr/bin/env node
// Generate a CSS extraction schema for a shop's search-results listing page.
// Pipeline:
//
//   1. Take the shop's `crawl.searchUrl` template (placeholder: literal "ipad").
//   2. Substitute a sample query, render via Crawl4AI to get the rendered HTML.
//   3. Trim the HTML to the listing container, send to Gemini.
//   4. Receive a Crawl4AI JsonCssExtractionStrategy schema with a baseSelector
//      that matches every result card and per-card fields.
//   5. Validate by running the schema on a second query — same schema, different
//      keyword — and report card count + per-field coverage.
//
//   pnpm gen:schema                       # default: softperten
//   pnpm gen:schema <slug>                # single store (verbose)
//   pnpm gen:schema <slug1> <slug2> ...   # batch (one summary at the end)
//
// Requires GEMINI_API_KEY (loaded from .env) and a running Crawl4AI on
// CRAWL4AI_URL (default: http://localhost:11235).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ── tiny .env loader (no dep) ───────────────────────────────────────────
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

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const CRAWL4AI_URL = process.env.CRAWL4AI_URL || 'http://localhost:11235'
if (!GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY missing — set it in .env or the shell environment.')
  process.exit(1)
}

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
// Two generic German queries that should return results on most general shops.
// First is used to generate the schema, second to validate generalization.
// For niche shops where these return zero results, set `crawl.sampleQuery`
// in store-overrides.json — it overrides both queries.
const GEN_QUERY = 'geschenk'
const VAL_QUERY = 'buch'
// The colleague used "ipad" as the literal placeholder string in every searchUrl.
const PLACEHOLDER = 'ipad'

const slugs = process.argv.slice(2).filter(Boolean)
if (slugs.length === 0)
  slugs.push('softperten')

const overrides = JSON.parse(readFileSync(resolve(ROOT, 'server/data/store-overrides.json'), 'utf8'))

function buildSearchUrl(template, query) {
  // Replace every occurrence of the placeholder. URL-encode to be safe even
  // for path-embedded placeholders (e.g. aliexpress's wholesale-ipad.html).
  return template.replaceAll(PLACEHOLDER, encodeURIComponent(query))
}

// ── Crawl4AI helpers ────────────────────────────────────────────────────
// Mirror server/api/crawl/index.post.ts so the schemas we generate are
// validated under the same conditions the production crawl will use:
// - scan_full_page + scroll_delay handles lazy-loaded card content
// - Sec-CH-UA* client hints help with galaxus-style anti-bot
// - cache_mode BYPASS to ensure we always see fresh HTML
async function crawl4ai({ url, schema = null }) {
  const res = await fetch(`${CRAWL4AI_URL}/crawl`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      urls: [url],
      browser_config: {
        type: 'BrowserConfig',
        params: {
          headless: true,
          viewport_width: 1900,
          viewport_height: 1200,
          headers: {
            'User-Agent': USER_AGENT,
            'Sec-CH-UA': '"Not_A Brand";v="99", "Google Chrome";v="120", "Chromium";v="120"',
            'Sec-CH-UA-Mobile': '?0',
            'Sec-CH-UA-Platform': '"Windows"',
          },
        },
      },
      crawler_config: {
        type: 'CrawlerRunConfig',
        params: {
          cache_mode: 5, // BYPASS
          page_timeout: 60000,
          delay_before_return_html: 2.5,
          session_id: `gen-${Date.now()}`,
          wait_for_images: true,
          exclude_all_images: true,
          exclude_external_links: true,
          exclude_social_media_domains: true,
          exclude_social_media_links: true,
          remove_forms: true,
          simulate_user: true,
          override_navigator: true,
          scan_full_page: true,
          scroll_delay: 0.5,
          ...(schema ? { extraction_strategy: { type: 'JsonCssExtractionStrategy', params: { schema, verbose: false } } } : {}),
        },
      },
    }),
  })
  if (!res.ok)
    throw new Error(`Crawl4AI HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const json = await res.json()
  const result = json?.results?.[0]
  if (!result)
    throw new Error('Crawl4AI returned no results')
  // Use raw html (not cleaned_html) — cleaned_html strips too many class
  // names the LLM relies on. Our trimmer slices to the listing container.
  const html = result.html || ''
  let extracted = null
  if (result.extracted_content) {
    try {
      extracted = JSON.parse(result.extracted_content)
    }
    catch {}
  }
  return { html, extracted }
}

// ── HTML trimming for LLM context ───────────────────────────────────────
// Strip noise that doesn't help the LLM identify selectors. Keep tags and
// classes intact since those are what we want a schema for. Try to slice
// down to the search-results listing container so the LLM doesn't burn its
// context budget on header/nav/footer.
function trimHtml(html, maxChars = 180000) {
  let out = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/\s{2,}/g, ' ')
  const bodyMatch = out.match(/<body[\s\S]*?<\/body>/i)
  if (bodyMatch)
    out = bodyMatch[0]

  const listing = findListingContainer(out)
  if (listing && listing.length < out.length)
    out = listing

  if (out.length > maxChars)
    out = `${out.slice(0, maxChars)}...[truncated]`
  return out
}

function findListingContainer(html) {
  // Listing-container hint patterns. Order is informational only — we collect
  // every match across all patterns, expand each to its closing tag, and pick
  // the LARGEST one. This avoids false positives from accessibility helpers
  // like Shopify's <div id="sr-country-search-results" class="visually-hidden">
  // which would otherwise trump the real <main> just by appearing earlier.
  const patterns = [
    /<[a-z][^>]*\b(?:id|class)\s*=\s*["'][^"']*(?:search-results|searchResults|search_result|results-grid|results-list|result-list|product-list|product-grid|productList|productsGrid|products-grid|product-listing|listing-grid|hits-list|hits|listing-products)[^"']*["'][^>]*>/gi,
    /<main\b[^>]*>/gi,
    /<[a-z][^>]*role\s*=\s*["']main["'][^>]*>/gi,
  ]
  const candidates = []
  for (const pat of patterns) {
    let m
    // eslint-disable-next-line no-cond-assign
    while ((m = pat.exec(html))) {
      const expanded = expandToClosingTag(html, m.index, m[0])
      if (expanded)
        candidates.push(expanded)
    }
  }
  if (candidates.length === 0)
    return null
  // Skip very small matches — they're almost certainly not the listing.
  // Keep all if none reach the threshold (better something than nothing).
  const MIN_LISTING_SIZE = 5000
  const big = candidates.filter(c => c.length >= MIN_LISTING_SIZE)
  const pool = big.length > 0 ? big : candidates
  return pool.reduce((largest, c) => (c.length > largest.length ? c : largest))
}

function expandToClosingTag(html, start, openTag) {
  const tagMatch = openTag.match(/^<([a-z]+)/i)
  if (!tagMatch)
    return null
  const tag = tagMatch[1].toLowerCase()
  const re = new RegExp(`<${tag}\\b|</${tag}>`, 'gi')
  re.lastIndex = start + openTag.length
  let depth = 1
  let mm
  // eslint-disable-next-line no-cond-assign
  while ((mm = re.exec(html))) {
    if (mm[0].toLowerCase().startsWith('</'))
      depth--
    else
      depth++
    if (depth === 0)
      return html.slice(start, mm.index + mm[0].length)
  }
  return null
}

// ── Gemini call ─────────────────────────────────────────────────────────
const TARGET_FIELDS = [
  { name: 'name', desc: 'Product display name' },
  { name: 'brand', desc: 'Brand or manufacturer (often hidden on cards — only include if clearly present)' },
  { name: 'price', desc: 'Current price as displayed (with or without currency formatting)' },
  { name: 'productUrl', desc: 'Link to the product detail page (read href from the card\'s primary anchor)' },
  { name: 'imageSrc', desc: 'Primary product thumbnail image URL (read src or data-src)' },
  { name: 'imageAlt', desc: 'Alt text on the product thumbnail image (read alt attribute on the SAME element used for imageSrc)' },
  { name: 'availability', desc: 'In-stock / out-of-stock indicator if shown on the card' },
  { name: 'sku', desc: 'SKU / article number if visible on the card (rare)' },
  { name: 'model', desc: 'Manufacturer\'s model code (e.g. "TSF02CREU"). Often rendered as a separate label like "Art.-Nr.", "Modell" or "MPN", but on many German shops it is wrapped in chevron quotes »...« inside the product name itself — in that case do NOT add a selector for model (we extract it from the name in post-processing).' },
]

const PROMPT = `You are generating a CSS extraction schema for a Crawl4AI JsonCssExtractionStrategy that will run against a search-results listing page on an e-commerce shop.

The page contains zero or more repeating product cards. Your job is to identify the repeating PRODUCT card pattern in the MAIN results grid and produce a schema that extracts one record per card.

The schema must be valid JSON with this exact shape:

{
  "type": "dict",
  "value": {
    "baseSelector": "<a CSS selector that matches EVERY product card in the main results grid>",
    "fields": [
      { "name": "<field>", "selector": "<CSS selector relative to one card>", "type": "text" },
      { "name": "<field>", "selector": "<CSS selector relative to one card>", "type": "attribute", "attribute": "<attr>" }
    ]
  }
}

WHAT IS A PRODUCT CARD (the thing you must target):
- A repeating element in the MAIN search-results grid that represents one product hit.
- Each card has a link to a unique product detail page, plus a product name and (usually) a price.
- The grid typically contains 12, 24, 48, or more cards. If the page is well-populated, the card count is large.
- baseSelector examples that are correct in shape: 'li.product-tile', 'article.product-card', 'div[data-product-id]', '.search-result-item', 'ff-record'.

WHAT YOU MUST NOT TARGET (these regions look superficially similar but are wrong):
- Autocomplete or search-suggestion dropdowns (class/id often contains 'suggest', 'autocomplete', 'typeahead', 'search-results-suggestions'). These are short lists that appear next to the search input.
- Navigation menus, mega-menus, category trees, breadcrumbs (class/id often contains 'nav', 'menu', 'breadcrumb', 'navigation', 'category-tree').
- Related-products / recently-viewed / cross-sell carousels (class/id often contains 'related', 'recently', 'cross-sell', 'recommend', 'similar').
- Filter facets, sort controls, pagination links.
- Footer links, header links, social media widgets.
- "No results found" placeholder cards or category-suggestion tiles shown when search has zero hits.

If you cannot find a clear main-results-grid card pattern (because the page truly has zero results, or because results are JS-rendered after the snapshot was taken), return:
  {"type":"dict","value":{"baseSelector":null,"fields":[]}}
Do NOT guess by picking the next-most-prominent repeating element — a wrong-target schema is worse than no schema.

GENERAL RULES:
- baseSelector must match multiple sibling elements (it's a repeating card). It must NOT be 'body' or 'main' or the grid wrapper itself.
- Field selectors are scoped INSIDE one card and must match exactly one element per card.
- "type": "text" reads innerText. "type": "attribute" reads an attribute (must include "attribute" key, e.g. "href", "src", "data-src").
- For productUrl, target the card's primary product anchor and read href. The href should look like a product detail path, not a category or search URL.
- For imageSrc, prefer src; fall back to data-src or srcset only if src is empty.
- Prefer semantic selectors (data attributes, itemprop, role) over fragile class chains when both are available.
- If a field cannot be located reliably across cards, omit it from "fields" rather than guessing.
- Always include "name" and "productUrl" if and only if you found a real card pattern.

Target fields (extract whichever you can locate):
${TARGET_FIELDS.map(f => `- ${f.name}: ${f.desc}`).join('\n')}

Below is the trimmed HTML of one search-results page. Inspect it, find the repeating PRODUCT card pattern in the main results grid, and return ONLY the JSON schema, no commentary, no markdown fences.

--- HTML START ---
{{HTML}}
--- HTML END ---`

async function callGemini(html) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${GEMINI_API_KEY}`
  const body = {
    contents: [{ parts: [{ text: PROMPT.replace('{{HTML}}', html) }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
  }
  let lastErr
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0)
      await new Promise(r => setTimeout(r, 2000 * 2 ** (attempt - 1)))
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) {
      const json = await res.json()
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text)
        throw new Error(`Gemini returned no text: ${JSON.stringify(json).slice(0, 300)}`)
      return JSON.parse(text)
    }
    const errText = await res.text()
    lastErr = `Gemini ${res.status}: ${errText.slice(0, 300)}`
    if (res.status < 500 && res.status !== 429)
      break
    console.log(`   retry ${attempt + 1}/3: ${res.status}`)
  }
  throw new Error(lastErr)
}

// ── per-slug runner ─────────────────────────────────────────────────────
const TARGET_NAMES = TARGET_FIELDS.map(f => f.name)
const outDir = resolve(ROOT, 'tmp/schemas')
mkdirSync(outDir, { recursive: true })

function summarizeCards(cards) {
  // For each target field, what fraction of cards had a non-empty value?
  if (!Array.isArray(cards) || cards.length === 0)
    return { count: 0, coverage: {} }
  const coverage = {}
  for (const f of TARGET_NAMES) {
    const filled = cards.filter(c => c && c[f] != null && String(c[f]).trim() !== '').length
    coverage[f] = filled / cards.length
  }
  return { count: cards.length, coverage }
}

// Heuristic guard: detect schemas that extracted SOMETHING but the cards are
// almost certainly not products (LLM picked nav, autocomplete, breadcrumb,
// etc.). Returns null if the schema looks plausible, or a string reason if
// it looks suspect — in which case the schema should be treated as failed.
const NON_PRODUCT_URL = /\/(?:search|suchen|suche|find|finden|kategorie|categor[a-z]*|cat|nav|menu|filter|sort|page|seite|tag|brand|marke|hersteller|sortiment|kollektion)(?:[/?#]|$)/i
const SEARCH_PARAM = /[?&](?:q|query|search|searchstring|text|keywords|searchTerm|zoek|s)=/i

function checkSchemaPlausibility(cards) {
  if (!Array.isArray(cards) || cards.length === 0)
    return null
  const urls = cards.map(c => c?.productUrl).filter(u => typeof u === 'string' && u.length > 0)
  if (urls.length === 0)
    return 'no productUrl extracted on any card'

  // 1. Most URLs should be unique. If many cards share the same URL, the
  // baseSelector likely matches a non-card pattern.
  const unique = new Set(urls).size
  if (unique / urls.length < 0.5)
    return `productUrls are not unique (${unique} unique / ${urls.length} cards) — likely matched non-card elements`

  // 2. URLs should look like product detail paths, not search/category/nav.
  const suspect = urls.filter((u) => {
    try {
      const path = u.startsWith('http') ? new URL(u).pathname : u.split('?')[0].split('#')[0]
      if (NON_PRODUCT_URL.test(path)) return true
      // Pure search URLs ('?q=...' with empty path) are clearly wrong.
      if (SEARCH_PARAM.test(u) && (path === '' || path === '/')) return true
      return false
    }
    catch { return false }
  })
  if (suspect.length / urls.length > 0.5)
    return `${suspect.length}/${urls.length} productUrls look like search/category/nav paths (e.g. ${suspect.slice(0, 2).join(', ')})`

  // 3. If many cards but every "name" is empty, that's a sign of wrong target.
  const namedCount = cards.filter(c => c?.name && String(c.name).trim().length > 0).length
  if (cards.length >= 5 && namedCount === 0)
    return 'no card has a non-empty name — schema likely matched the wrong region'

  return null
}

async function runForSlug(slug, { verbose }) {
  const log = verbose ? (...a) => console.log(...a) : () => {}

  const store = overrides[slug]
  if (!store)
    throw new Error(`Store "${slug}" not found in overrides`)
  const template = store.crawl?.searchUrl
  if (!template)
    throw new Error(`Store "${slug}" has no crawl.searchUrl (manual review needed)`)
  if (!template.includes(PLACEHOLDER))
    throw new Error(`searchUrl for "${slug}" does not contain placeholder "${PLACEHOLDER}"`)

  // If the colleague set a per-store sampleQuery (because the generic
  // "geschenk"/"buch" return zero results on a niche shop), use it for
  // both gen and val. We lose cross-query generalization testing, but
  // generating against real cards beats validating on an empty page.
  const sample = store.crawl?.sampleQuery
  const genQuery = sample || GEN_QUERY
  const valQuery = sample || VAL_QUERY
  const genUrl = buildSearchUrl(template, genQuery)
  const valUrl = buildSearchUrl(template, valQuery)

  log(`Generating listing schema for "${slug}"${sample ? ` (sampleQuery="${sample}")` : ''}\n`)
  log(`   gen URL:      ${genUrl}`)
  log(`   validate URL: ${valUrl}\n`)

  log('1. Rendering generation page via Crawl4AI…')
  const { html: rawHtml } = await crawl4ai({ url: genUrl })
  if (!rawHtml || rawHtml.length < 1000)
    throw new Error(`Crawl4AI returned empty/too-small HTML (${rawHtml?.length || 0} chars)`)
  const trimmed = trimHtml(rawHtml)
  log(`   raw: ${rawHtml.length} chars → trimmed: ${trimmed.length} chars\n`)

  log('2. Asking Gemini for listing schema…')
  const schema = await callGemini(trimmed)
  const baseSelector = schema?.value?.baseSelector
  log(`   baseSelector: ${baseSelector}`)
  log(`   fields:       ${(schema?.value?.fields || []).map(f => f.name).join(', ')}\n`)

  const schemaPath = resolve(outDir, `${slug}.json`)
  writeFileSync(schemaPath, `${JSON.stringify(schema, null, 2)}\n`)
  log(`   saved: ${schemaPath}\n`)

  // LLM declined (per prompt contract: baseSelector=null when no real card
  // pattern exists). Skip validation; the schema is intentionally empty.
  if (!baseSelector || baseSelector === 'null') {
    return {
      slug,
      genUrl,
      valUrl,
      schema,
      baseSelector: null,
      fieldCount: 0,
      genCardCount: 0,
      valCardCount: 0,
      workingFields: [],
      missingFields: TARGET_NAMES,
      coverage: {},
      suspectReason: 'LLM declined (no clear product-card pattern in HTML — likely anti-bot block, JS-only render, or zero results)',
    }
  }

  log('3. Validating: extracting cards on both queries…')
  const [genRun, valRun] = await Promise.all([
    crawl4ai({ url: genUrl, schema }),
    crawl4ai({ url: valUrl, schema }),
  ])
  // Mirror the webhook's name-from-imageAlt fallback so the plausibility
  // guard doesn't reject Shopify-style schemas where the product title is
  // only present as the image alt text (e.g. padel-point).
  for (const c of [...(genRun.extracted || []), ...(valRun.extracted || [])]) {
    if ((!c?.name || !c.name.trim()) && c?.imageAlt?.trim())
      c.name = c.imageAlt.trim()
  }
  const genStats = summarizeCards(genRun.extracted)
  const valStats = summarizeCards(valRun.extracted)
  log(`   gen cards: ${genStats.count}`)
  log(`   val cards: ${valStats.count}\n`)

  if (verbose && genRun.extracted?.[0])
    log(`   sample card (gen[0]): ${JSON.stringify(genRun.extracted[0], null, 2)}\n`)

  // A field "works" if it's filled on >= 50% of cards across both runs combined.
  const allCards = [...(genRun.extracted || []), ...(valRun.extracted || [])]
  const overall = summarizeCards(allCards)
  const suspectReason = checkSchemaPlausibility(allCards)
  const workingFields = suspectReason ? [] : TARGET_NAMES.filter(f => (overall.coverage[f] ?? 0) >= 0.5)
  const missingFields = TARGET_NAMES.filter(f => !workingFields.includes(f))

  if (verbose) {
    log(`── Result ──`)
    log(`Total cards across both queries: ${overall.count}`)
    if (suspectReason)
      log(`Schema rejected: ${suspectReason}`)
    else
      log(`Fields working (≥50% coverage): ${workingFields.length}/${TARGET_NAMES.length} — ${workingFields.join(', ') || '(none)'}`)
    if (!suspectReason && missingFields.length > 0)
      log(`Missing/sparse:                  ${missingFields.join(', ')}`)
  }

  return {
    slug,
    genUrl,
    valUrl,
    schema,
    baseSelector: schema?.value?.baseSelector,
    fieldCount: schema?.value?.fields?.length || 0,
    genCardCount: genStats.count,
    valCardCount: valStats.count,
    workingFields,
    missingFields,
    coverage: overall.coverage,
    suspectReason,
  }
}

// ── CLI dispatch ────────────────────────────────────────────────────────
if (slugs.length === 1) {
  await runForSlug(slugs[0], { verbose: true })
}
else {
  console.log(`Batch mode: ${slugs.length} stores\n`)
  const results = []
  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i]
    process.stdout.write(`[${i + 1}/${slugs.length}] ${slug.padEnd(32, ' ')}`)
    try {
      const r = await runForSlug(slug, { verbose: false })
      results.push({
        slug,
        ok: true,
        baseSelector: r.baseSelector,
        fieldCount: r.fieldCount,
        genCardCount: r.genCardCount,
        valCardCount: r.valCardCount,
        workingFields: r.workingFields,
        missingFields: r.missingFields,
        coverage: r.coverage,
        suspectReason: r.suspectReason,
        genUrl: r.genUrl,
        valUrl: r.valUrl,
      })
      const status = r.suspectReason
        ? `⚠ rejected: ${r.suspectReason.slice(0, 80)}`
        : `✓ cards=${r.genCardCount}/${r.valCardCount}  fields=${r.workingFields.length}/${TARGET_NAMES.length}  base=${r.baseSelector}`
      console.log(status)
    }
    catch (err) {
      const message = err?.message || String(err)
      results.push({ slug, ok: false, error: message })
      console.log(`✗ ${message.slice(0, 140)}`)
    }
  }
  const ok = results.filter(r => r.ok)
  const summary = {
    generatedAt: new Date().toISOString(),
    totalStores: slugs.length,
    succeeded: ok.length,
    failed: results.length - ok.length,
    storesWithCards: ok.filter(r => r.genCardCount > 0 || r.valCardCount > 0).length,
    avgWorkingFields: ok.reduce((s, r) => s + r.workingFields.length, 0) / Math.max(1, ok.length),
    byStore: results,
  }
  const summaryPath = resolve(outDir, '_summary.json')
  writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`)
  console.log(`\nSummary: ${summary.succeeded}/${summary.totalStores} ran, ${summary.storesWithCards} extracted cards, avg ${summary.avgWorkingFields.toFixed(1)} working fields/store`)
  console.log(`Saved:   ${summaryPath}`)
}
