import type { AlgoliaProduct } from '~~/types/algolia'
import type { CrawledItem } from '~~/types/crawler'
import { put } from '@vercel/blob'
import { upsetAlgoliaObjects } from '~~/server/lib/algolia'
import sendSlackMessage from '~~/server/lib/send-slack-message'
import { peers } from '~~/server/routes/ws'

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

// Names we know are schema-default sentinels, not real product names.
// Crawl4AI's JsonCssExtractionStrategy lets a field set a `default`
// value when the selector doesn't match — handy for absorbing missing
// optional fields, but it also masks "this isn't a real card" cases
// (e.g. Galaxus has Q&A `<article>` elements with no product info).
// Add to this set whenever a new placeholder shows up in production.
const NAME_BLOCKLIST: ReadonlySet<string> = new Set([
  'Click the button below to see more',
  'RVDISPLAYNAME',
])

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

// Quick predicate for the upsert filter. Returns true when the item
// looks like a real product card; false drops it before it reaches
// Algolia.
function isUsableProduct(item: { name?: string, productUrl?: string }): boolean {
  const name = item.name?.trim()
  if (!name)
    return false
  if (NAME_BLOCKLIST.has(name))
    return false
  if (item.productUrl && NON_PRODUCT_URL_PATH.test(item.productUrl))
    return false
  if (item.productUrl && TEMPLATE_PLACEHOLDER_URL.test(item.productUrl))
    return false
  return true
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

  // The remaining headers are required for downstream business logic
  // (Algolia object shape + Slack messages). 400 is honest here since
  // the caller is already authenticated.
  if (!group)
    throw createError({ statusCode: 400, statusMessage: 'Header X-Group is missing' })
  if (!domain)
    throw createError({ statusCode: 400, statusMessage: 'Header X-Domain is missing' })
  if (!initialQuery)
    throw createError({ statusCode: 400, statusMessage: 'Header X-Initial-Query is missing' })

  if (body.status === 'failed') {
    console.error(`Crawl task ${body.task_id} failed with error`, body.error)
    sendSlackMessage(config.slackWebhookUrl, {
      title: `:sob: *${body.task_id}* Crawl failed for domain ${domain}`,
      jsonString: body.error,
    })
    return { success: false, message: `Crawl task failed: ${body.error}` }
  }
  else if (body.status === 'completed') {
    if (!body.data?.results[0].success) {
      sendSlackMessage(config.slackWebhookUrl, {
        title: `:sob: *${body.task_id}* Crawl failed for domain ${domain}`,
        jsonString: 'Check crawler errors in railway or logs in vercel',
      })
      console.error(`Crawl task ${body.task_id} failed with error`, body.data?.results[0].error_message)
      throw createError({
        statusCode: 500,
        statusMessage: 'Check crawler errors in railway',
      })
    }
    const items: CrawledItem[] = body.data?.results.reduce((accumulator, currentObj) => {
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

    let slackInfo = ''

    if (items.length === 0) {
      // Crawl4AI succeeded; the shop simply returned zero matches for this
      // query. That's a legitimate user-search outcome, not an error — log
      // informationally and skip the Slack alarm. Genuine schema/auth
      // failures are reported earlier in this handler (status === 'failed'
      // or results[0].success === false), which still fire alerts.
      console.warn(`Crawl ${body.task_id}: 0 items extracted from ${body.urls.join(', ')} — query returned no results`)
      return { success: true }
    }
    slackInfo = `Extracted ${items.length || 0} items. Search URLs ${body.urls.join(', ')}\n`
    items.filter(item => !item.price).forEach((item) => {
      slackInfo += `- Item without price found: ${item.name} - ${item.productUrl}. Double check why price not crawled\n\n`
    })

    sendSlackMessage(config.slackWebhookUrl, {
      title: `:wrench: *${body.task_id}* Crawl finish and ${items.length || 0} items were found`,
      jsonString: slackInfo,
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
      upsetAlgoliaObjects(formattedResults, config).then((response) => {
        sendSlackMessage(config.slackWebhookUrl, {
          title: `:checkered_flag: *${body.task_id}* Algolia upload with *${response[0]?.objectIDs.length || 0}* items finished. @Marcel @niklas.grieger`,
        })
        peers.forEach(peer => peer.send(`{"source": "crawl.newData", "meta": { "itemCount": ${response[0]?.objectIDs.length || 0}, "initialQuery": "${formattedResults[0].name.substring(0, 5)}" } }`))
      })
    }
    else {
      // Create task for approvement
      if (formattedResults.length === 0)
        return
      const { url } = await put(`crawl/to-approve/${config.public.algoliaProductIndex}-${body.task_id}.json`, JSON.stringify({ initialQuery, items: formattedResults }), { access: 'public', contentType: 'application/json' })

      sendSlackMessage(config.slackWebhookUrl, {
        title: `:wrench: *${body.task_id}* Automatic Algolia update is disabled and task is waiting for appove of *${formattedResults.length}* items. @Marcel @niklas.grieger`,
        approveUploadActionUrl: `${config.baseUrl}/internal/approve-crawl?fileUrl=${url}`,
      })
    }
  }

  return { success: true }
})
