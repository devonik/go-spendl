import type { AlgoliaProduct } from '~~/types/algolia'
import type { CrawledItem } from '~~/types/crawler'
import { Redis } from '@upstash/redis'
import { upsetAlgoliaObjects } from '~~/server/lib/algolia'
import { CRAWL_EVENTS_CHANNEL } from '~~/server/lib/crawl-events-channel'
import { recordShopResult } from '~~/server/lib/crawl-run'

interface CompleteCrawlWebhookPayload {
  task_id: string
  task_type: 'crawl'
  status: 'completed' | 'failed'
  timestamp: string
  urls: string[]
  data?: {
    success: true
    results: Crawl4AIData[]
    server_processing_time_s: number
    server_memory_delta_mb: number
    server_peak_memory_mb: number
  }
  error?: string
}

interface Crawl4AIData {
  url: string
  html: string
  fit_html: string
  success: boolean
  cleaned_html: unknown
  media: Record<string, unknown>
  links: Record<string, unknown>
  downloaded_files: unknown
  js_execution_result: unknown
  screenshot: unknown
  pdf: unknown
  mhtml: unknown
  extracted_content: string | null
  metadata: Record<string, unknown> | null
  error_message: string | null
  session_id: unknown
  response_headers: unknown
  status_code: unknown
  ssl_certificate: unknown
  dispatch_result: unknown
  redirected_url: unknown
  network_requests: unknown
  console_messages: unknown
  tables: unknown[]
}

// Strip screen-reader labels that some shops (notably Shopify themes) emit
// inside the price element, then collapse whitespace and pick the first
// complete currency token. For sale items this gives the sale price (which
// is what the user actually pays). Returns the cleaned input — never null —
// so a partial cleanup is preferred over losing the value entirely.
const PRICE_LABELS = /Verkaufspreis|Normaler\s*Preis|Angebotspreis|Sonderpreis|Grundpreis|UVP|Sale\s*price|Regular\s*price|From\s|Ab\s|Von\s/gi
const PRICE_TOKEN = /[\d.,]+\s*(?:[€$£]|EUR|USD|CHF|GBP)/i

function normalizePrice(raw: string): string {
  if (!raw)
    return raw
  const stripped = raw.replace(PRICE_LABELS, ' ').replace(/\s+/g, ' ').trim()
  const m = stripped.match(PRICE_TOKEN)
  return m ? m[0].trim() : stripped
}

// Path segments that clearly aren't product detail pages. Used to drop
// items that snuck through with a non-product URL — Q&A, help, blog,
// FAQ etc. Matches only as a whole path segment so we don't accidentally
// reject product slugs that contain one of these substrings.
const NON_PRODUCT_URL_PATH = /\/(?:questionandanswer|qa|q|help|support|service|blog|blogs|magazin|magazine|ratgeber|guide|guides|faq|kontakt|impressum|agb|datenschutz|about|news|presse|jobs|karriere)\//i

// Server-side template placeholders that leaked into the rendered HTML
// instead of being substituted. ASP.NET listing engines (biggreensmile)
// emit `#RVLINK` style anchors on hidden template rows; older PHP sites
// emit `{ProductUrl}` style curly braces. Both shapes can be detected
// without false-positiving real product URLs.
const TEMPLATE_PLACEHOLDER_URL = /#[A-Z]{3,}|\{[A-Za-z][A-Za-z0-9]*\}/

// A productUrl is "usable" if it actually navigates somewhere meaningful.
// Catches placeholder anchors, empty paths, template variables and obvious
// non-product paths. Doing this URL-level keeps the filter generic — new
// shop quirks tend to emit junk URLs *and* junk names at the same time, so
// blocking the URL is enough without maintaining per-shop name lists.
function isUsableProductUrl(url?: string): boolean {
  if (!url)
    return false
  if (url === '/' || url.startsWith('#'))
    return false
  if (TEMPLATE_PLACEHOLDER_URL.test(url))
    return false
  if (NON_PRODUCT_URL_PATH.test(url))
    return false
  try {
    const path = new URL(url, 'http://placeholder').pathname
    if (!path || path === '/')
      return false
  }
  catch {
    return false
  }
  return true
}

// Quick predicate for the upsert filter. Returns true when the item
// looks like a real product card; false drops it before it reaches
// Algolia.
function isUsableProduct(item: { name?: string, productUrl?: string }): boolean {
  if (!item.name?.trim())
    return false
  return isUsableProductUrl(item.productUrl)
}

// Resolve a possibly-relative URL extracted from a shop's listing card
// against the actual store origin. Covers absolute URLs (returned as-is),
// protocol-relative URLs (`//cdn.shop/x.jpg` from Shopify image srcs),
// and root-relative paths. The shopDomain header carries the store's
// *slug* (e.g. "padel-point"), not its hostname, so concatenating it
// produces invalid URLs like https://padel-point/products/foo — we use
// the search URL the crawl was started from to recover the real origin.
function resolveUrl(maybeRelative: string, storeOrigin: string | null): string {
  if (!maybeRelative)
    return maybeRelative
  if (/^https?:\/\//i.test(maybeRelative))
    return maybeRelative
  if (maybeRelative.startsWith('//'))
    return `https:${maybeRelative}`
  if (storeOrigin)
    return `${storeOrigin}${maybeRelative.startsWith('/') ? '' : '/'}${maybeRelative}`
  return maybeRelative
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  // Auth first — bail before reading the body or doing anything else if
  // the shared secret doesn't match. Mirrors the cron-handler pattern:
  // collapse missing-vs-wrong into a single 401 so we don't leak which
  // header was the problem to an unauthenticated caller.
  if (!config.crawlWebhookSecret || getHeader(event, 'X-Webhook-Secret') !== config.crawlWebhookSecret) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const body = await readBody<CompleteCrawlWebhookPayload>(event)
  const group = getHeader(event, 'X-Group')
  const domain = getHeader(event, 'X-Domain')
  const category = getHeader(event, 'X-Category')
  const initialQuery = getHeader(event, 'X-Initial-Query')
  const runId = getHeader(event, 'X-Run-Id')
  const runTotal = Number(getHeader(event, 'X-Run-Total'))

  // The remaining headers are required for downstream business logic
  // (Algolia object shape + run-summary correlation). 400 is honest here
  // since the caller is already authenticated.
  if (!group)
    throw createError({ statusCode: 400, statusMessage: 'Header X-Group is missing' })
  if (!domain)
    throw createError({ statusCode: 400, statusMessage: 'Header X-Domain is missing' })
  if (!initialQuery)
    throw createError({ statusCode: 400, statusMessage: 'Header X-Initial-Query is missing' })
  if (!runId)
    throw createError({ statusCode: 400, statusMessage: 'Header X-Run-Id is missing' })
  if (!runTotal || Number.isNaN(runTotal))
    throw createError({ statusCode: 400, statusMessage: 'Header X-Run-Total is missing or invalid' })

  const mode: 'auto' | 'approval' = config.isCrawlUploadAutomaticEnabled === 'true' ? 'auto' : 'approval'

  if (body.status === 'failed') {
    console.error(`Crawl task ${body.task_id} failed with error`, body.error)
    await recordShopResult({
      runId,
      runTotal,
      slackWebhookUrl: config.slackWebhookUrl,
      baseUrl: config.baseUrl,
      result: { slug: domain, status: 'failed', mode, itemCount: 0, error: body.error },
    })
    return { success: false, message: `Crawl task failed: ${body.error}` }
  }
  else if (body.status === 'completed') {
    const firstResult = body.data?.results[0]
    if (!firstResult?.success) {
      console.error(`Crawl task ${body.task_id} failed with error`, firstResult?.error_message)
      await recordShopResult({
        runId,
        runTotal,
        slackWebhookUrl: config.slackWebhookUrl,
        baseUrl: config.baseUrl,
        result: { slug: domain, status: 'failed', mode, itemCount: 0, error: firstResult?.error_message || 'Check crawler errors in railway or logs in vercel' },
      })
      throw createError({
        statusCode: 500,
        statusMessage: 'Check crawler errors in railway',
      })
    }
    const items: CrawledItem[] = (body.data?.results ?? []).reduce((accumulator, currentObj) => {
      if (!currentObj.extracted_content)
        return []
      const json = JSON.parse(currentObj.extracted_content)
      return accumulator.concat(json)
    }, [])

    // Shopify-style shops often render the product title only as the image's
    // `alt` attribute on listing cards (the visible heading is JS-rendered).
    // If the schema didn't capture a `name` but did capture `imageAlt`, use
    // that — must run before the model extractor below since model is parsed
    // out of name.
    for (const item of items) {
      if ((!item.name || !item.name.trim()) && item.imageAlt?.trim())
        item.name = item.imageAlt.trim()
    }

    // Drop items that aren't real products — schema-default sentinel
    // names (e.g. Galaxus' "Click the button below to see more" leaking
    // out of the catch-all `<article>` selector when a Q&A entry was
    // matched) and items pointing at obvious non-product URLs (Q&A,
    // help, blog, etc.). Runs after the imageAlt fallback so we don't
    // throw away items that just need that fallback to populate name.
    const droppedCount = items.length
    const filteredItems = items.filter(isUsableProduct)
    const dropped = droppedCount - filteredItems.length
    if (dropped > 0)
      console.warn(`[webhook] dropped ${dropped} non-product item(s) from ${domain} crawl`)
    items.length = 0
    items.push(...filteredItems)

    // Many German shops embed the manufacturer's model code inside the product
    // name in chevron quotes, e.g. "Toaster »TSF02CREU« 2 lange Schlitze" or
    // "Smartwatch-Armband »Apple Strap, CS2009S1«". When the chevron content
    // has comma-separated parts the article number is conventionally the last
    // one, so we take that piece. Single-piece content (no comma) gets used
    // verbatim — covers the simpler "TSF02CREU" case.
    for (const item of items) {
      if (!item.model && item.name) {
        const match = item.name.match(/»([^»«]+)«/)
        if (match?.[1]) {
          const inside = match[1].trim()
          const parts = inside.split(',').map(p => p.trim()).filter(Boolean)
          item.model = parts.length > 0 ? parts[parts.length - 1] : inside
        }
      }
    }

    // Normalize price strings so Algolia stores something usable.
    // Shopify-style price elements often concatenate screen-reader labels
    // and both sale + regular prices into one blob, e.g.
    //   "Verkaufspreis59,95 €Normaler Preis150,00"
    // We strip known labels and pick the first complete price token —
    // for sale items that's the sale price (the one the user actually pays).
    for (const item of items) {
      if (item.price)
        item.price = normalizePrice(item.price)
    }

    if (items.length === 0) {
      // Crawl4AI succeeded; the shop simply returned zero matches for this
      // query. That's a legitimate user-search outcome, not an error — log
      // informationally, still record it so the run's shop count stays
      // accurate. Genuine schema/auth failures are reported earlier in this
      // handler (status === 'failed' or results[0].success === false).
      console.warn(`Crawl ${body.task_id}: 0 items extracted from ${body.urls.join(', ')} — query returned no results`)
      await recordShopResult({
        runId,
        runTotal,
        slackWebhookUrl: config.slackWebhookUrl,
        baseUrl: config.baseUrl,
        result: { slug: domain, status: 'ok', mode, itemCount: 0, initialQuery },
      })
      return { success: true }
    }
    items.filter(item => !item.price).forEach((item) => {
      console.warn(`[webhook] item without price found for ${domain}: ${item.name} - ${item.productUrl}. Double check why price not crawled`)
    })

    // Items without a price are still indexed — the frontend renders a
    // "see in shop" placeholder. The Slack notification above flags them
    // so the schema's price selector can be corrected manually.
    // The crawled search URLs all share the shop's origin; use it to
    // resolve any relative productUrls extracted from cards.
    let storeOrigin: string | null = null
    try {
      if (body.urls?.[0])
        storeOrigin = new URL(body.urls[0]).origin
    }
    catch { }
    // Stamp every upserted record with the time we last saw the product on
    // the shop. The refresh + eviction crons range-filter on this — anything
    // older than the eviction threshold gets purged from the index.
    const lastCrawledAt = Math.floor(Date.now() / 1000)
    const formattedResults: AlgoliaProduct[] = items.map((item) => {
      // Get a copy from item without the colors
      const { color1, color2, color3, colorMore, ...rest } = item
      let colors = item.color1
      if (item.color2)
        colors += `, ${item.color2}`
      if (item.color3)
        colors += `, ${item.color3}`
      if (item.colorMore)
        colors += `, ${item.colorMore}`

      const itemNameSterilized = item.name.replace(/[^a-z0-9 ]/gi, '').replaceAll(' ', '-').toLowerCase()
      const descriptionSterilized = item.description?.replace(/[^a-z0-9 ]/gi, '').replaceAll(' ', '-').toLowerCase()
      return {
        ...rest,
        objectID: `${domain}-${descriptionSterilized ? `${itemNameSterilized}-${descriptionSterilized}` : itemNameSterilized}`,
        group,
        shopDomain: domain,
        category,
        colors,
        productUrl: resolveUrl(item.productUrl, storeOrigin),
        // Shopify embeds CDN image srcs as protocol-relative `//cdn.shop/…`;
        // resolveUrl prepends https: so Algolia stores a usable absolute URL.
        imageSrc: item.imageSrc ? resolveUrl(item.imageSrc, storeOrigin) : item.imageSrc,
        lastCrawledAt,
      }
    })

    if (config.isCrawlUploadAutomaticEnabled === 'true') {
      const response = await upsetAlgoliaObjects(formattedResults, config)
      const itemCount = response[0]?.objectIDs.length || 0

      const kvUrl = config.kvRestApiUrl
      const kvToken = config.kvRestApiToken
      if (!kvUrl || !kvToken) {
        console.warn('[webhook] Upstash Redis env vars missing — skipping crawl.newData publish')
      }
      else {
        // Deep-link the banner back to a query that will actually surface
        // the crawled records in Algolia. Shop on-site search often
        // returns loosely related products whose text does not contain
        // the user's original query — e.g. searching "staubsauger" turns
        // up "Vorwerk Bodenwischer VB100". Re-searching the user's exact
        // query would give the same 0 hits the crawl was fired to fix.
        // Take the first word of the first crawled product name instead
        // (fallback to the first 8 characters when the name has no
        // whitespace); Algolia's prefix + typo tolerance handles the rest.
        const firstName = formattedResults[0]?.name?.trim() ?? ''
        const firstWord = firstName.split(/\s+/)[0] ?? ''
        const searchQuery = firstWord.length >= 3 ? firstWord : (firstName.slice(0, 8) || initialQuery)

        const publisher = new Redis({ url: kvUrl, token: kvToken })
        await publisher.publish(CRAWL_EVENTS_CHANNEL, {
          source: 'crawl.newData',
          meta: {
            itemCount,
            initialQuery: searchQuery,
            domain,
          },
        }).catch((err: unknown) => {
          console.error('[webhook] redis publish failed', err)
        })
      }

      await recordShopResult({
        runId,
        runTotal,
        slackWebhookUrl: config.slackWebhookUrl,
        baseUrl: config.baseUrl,
        result: { slug: domain, status: 'ok', mode, itemCount, initialQuery },
      })
    }
    else {
      // Stash for manual approval — the run summary Slack (fired once all
      // shops in the run have reported in) links to the approval UI.
      await recordShopResult({
        runId,
        runTotal,
        slackWebhookUrl: config.slackWebhookUrl,
        baseUrl: config.baseUrl,
        result: { slug: domain, status: 'ok', mode, itemCount: formattedResults.length, initialQuery, items: formattedResults },
      })
    }
  }

  return { success: true }
})
