# Crawl Pipeline

A walkthrough of how `gospendl` discovers products across hundreds of shops:
how we generate per-shop CSS extraction schemas with an LLM, how the live
crawl uses those schemas to populate Algolia, and the data-quality
guardrails along the way.

The intended reader is another LLM or engineer onboarding to the area
without prior context. File paths, env vars, and config values are
included so claims are independently verifiable in the repo.

## Why this exists

The original architecture (`server/utils/shop-config.ts`, removed) carried
~10 hand-curated entries with hardcoded `searchURL(query, locale)` builders
and `productCssShema` objects per shop. That doesn't scale to the ~900
shops the Satsback partner catalog exposes for Germany. We needed:

1. Per-shop CSS extraction schemas without writing them by hand.
2. A way to fan crawl requests out across shops only when (and where) it
   matters, without DDOSing Crawl4AI.
3. Clear failure modes: bad data should be **rejected**, not silently
   written to Algolia.

The chosen approach:

- An LLM (Gemini Flash Lite) generates a Crawl4AI `JsonCssExtractionStrategy`
  for each shop's **search-results listing page**, not its product detail
  pages. Listing cards are far more uniform than product detail templates.
- The schema lives per-shop in `server/data/store-overrides.json` under
  `crawl.schema`. Cron + script tools keep that file in sync with the live
  Satsback catalog.
- The live `/api/crawl` endpoint reads from that JSON, fans out via the
  existing webhook flow, and normalizes the extracted data on the way into
  Algolia.

## End-to-end flow

```
User search
   │
   ├── Algolia returns cached hits → render in ProductCard / ResultHits
   │
   └── 0 hits → ResultHits fires POST /api/crawl
                  │
                  ├── infer categories from query (frontend keyword map)
                  ├── filter cachedStores('germany') → crawlable + searchUrl + schema (+ category)
                  ├── for each store:
                  │     ├── substitute placeholder "ipad" → encoded user query
                  │     ├── add paging URL if shop has crawl.paging.pageQueryParam
                  │     └── POST /crawl/job to Crawl4AI with the stored schema
                  │
                  └── Crawl4AI POSTs results back to /api/crawl/webhook
                          ├── normalize: imageAlt→name, model, price, productUrl
                          └── upsert into Algolia (or stash for manual approve)
```

## Schema generation (offline)

The point of this layer: turn a shop URL into a Crawl4AI extraction schema
without hand-tuning.

### Why search-results pages, not product detail

Empirically, product detail pages have lots of templates per shop (variant
pages, out-of-stock states, sale layouts, related-products carousels). An
LLM looking at a detail page often picks the wrong region. Listing cards,
in contrast, have one repeating pattern that's visually obvious in the HTML
(a `<li class="product-tile">…</li>` row repeated 12–48 times). Schemas
generalize across queries on the same shop and across shops within the same
CMS family.

Result on a random sample of 30 shops: **~33% produced working schemas
first try**, ~43% the LLM correctly declined, ~7% failed the plausibility
guard (caught wrong-region picks before they reached Algolia), ~17%
infrastructure errors (Crawl4AI timeouts, Cloudflare 403s on anti-bot
shops). Hand-picked variety samples land closer to 60–70%.

### `pnpm gen:schema <slug>` — the generator

Source: [`scripts/generate-css-schema.mjs`](scripts/generate-css-schema.mjs).

Pipeline per shop:

1. Read `crawl.searchUrl` from `store-overrides.json`. Every entry uses the
   literal string `"ipad"` as the query placeholder (the colleague's
   convention).
2. Substitute the placeholder with a generic sample query: `geschenk` for
   generation, `buch` for validation — both broad German terms most general
   shops return results for. Niche shops set `crawl.sampleQuery` (e.g.
   `racket` for `padel-point`) to override.
3. Render the page via Crawl4AI with the **production crawler config**
   (see below — `scan_full_page`, client hints, etc.). This is critical:
   the LLM has to see the same DOM the production crawl will see.
4. Slice the raw HTML to the largest matching listing container (see
   "HTML trim" below). Drop scripts/styles/SVG/noscript first; cap at
   180 KB.
5. POST the trimmed HTML to Gemini Flash Lite (`gemini-flash-lite-latest`
   — free-tier; `gemini-2.0-flash` is paid-only on the account in use).
6. Parse the returned schema, run it against Crawl4AI on the same gen URL
   and the validation URL.
7. Run the plausibility guard. Save to `tmp/schemas/<slug>.json` if it
   passes, with a per-run `_summary.json` for batch mode.

Batch mode: `pnpm gen:schema slug1 slug2 …` accumulates results into the
summary so you can sweep 30–50 shops at once.

### The prompt — what makes it work

Three things mattered:

1. **Explicit anti-patterns.** "Do NOT target autocomplete dropdowns,
   navigation menus, breadcrumbs, related-products carousels, footer
   widgets, recently-viewed widgets, filter facets, sort controls,
   pagination links, or no-results placeholder tiles." Without this,
   the LLM cheerfully grabbed Shopify's `<div id="sr-country-search-results"
   class="visually-hidden">` accessibility helper as the listing container.

2. **A clean opt-out clause.** "If you can't find a clear main-results
   card pattern, return `{ baseSelector: null, fields: [] }`." Without
   the opt-out, the LLM hallucinated plausible-looking classes
   (`.product-tile`, `.price-current`) that didn't exist in the actual
   HTML, producing 0-extraction schemas that LOOKED valid. With the
   opt-out, ~13 of 30 shops in our sample correctly say "no usable
   pattern here" and we skip them cleanly.

3. **Anti-hallucination signal in the HTML.** Use raw `result.html` from
   Crawl4AI, NOT `result.cleaned_html`. The cleaned variant strips many
   classes the LLM relies on, which leads to hallucination even when good
   selectors exist. Switching `baur` from cleaned to raw went from 0
   cards extracted to 72.

The full prompt lives at top of `scripts/generate-css-schema.mjs`.

### HTML trim and the "largest container wins" heuristic

After stripping scripts/styles, we look for likely listing wrappers
(`<main>`, elements with `id`/`class` matching `search-results|product-grid|
results-list|...`, `[role=main]`), expand each to its closing tag, and
keep the **largest** one. Earlier versions took the first match, which
mistook a tiny accessibility-only `<div id="sr-country-search-results"
class="visually-hidden">` for the listing container and trimmed 1 MB of
HTML down to 80 chars.

### Plausibility guard

After validation, before counting a schema as successful, we run three
sanity checks:

1. **URL uniqueness.** If >50% of extracted productUrls duplicate each
   other, the baseSelector probably matched a non-card pattern. Reject.
2. **URL shape.** If most productUrls look like `/search?q=…`,
   `/category/…`, or other obvious-nav paths, reject.
3. **Name presence.** If we got ≥5 cards but every `name` field is empty,
   the schema landed on the wrong region. Reject.

(2) caught `life-extension-4` in one batch — the LLM had picked an
element where 12 unique URLs spread across 40 "cards" because it matched
a non-card pattern. Without the guard, those would have polluted Algolia.

### Fallbacks: imageAlt → name

Shopify themes commonly render the product title only as the image's
`alt` attribute on listing cards. The LLM dutifully extracts an empty
`name` field, then the plausibility guard fires "name presence". Both
the **generator** (`scripts/generate-css-schema.mjs`, before the guard
runs) and the **webhook** (`server/api/crawl/webhook.post.ts`) copy
`imageAlt → name` when `name` is empty. This salvages padel-point and
similar Shopify-templated shops.

## Crawler config — must mirror prod

Important: the generator's Crawl4AI config must match the one in
`server/api/crawl/index.post.ts`, otherwise schemas validated under the
generator's config break in production. Both use:

```ts
{
  cache_mode: BYPASS,           // always see fresh DOM
  scan_full_page: true,         // triggers lazy-loaded images
  scroll_delay: 0.5,            // pace the scroll
  wait_for_images: true,
  delay_before_return_html: 2.5,
  page_timeout: 60000,
  simulate_user: true,
  override_navigator: true,
  exclude_all_images: true,     // we keep the <img src> attributes
  exclude_external_links: true,
  exclude_social_media_*: true,
  remove_forms: true,
  // Client hints — required for galaxus-class anti-bot
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ... Chrome/120…',
    'Sec-CH-UA': '"Not_A Brand";v="99", "Google Chrome";v="120", "Chromium";v="120"',
    'Sec-CH-UA-Mobile': '?0',
    'Sec-CH-UA-Platform': '"Windows"',
  },
}
```

`scan_full_page` is the lazy-load fix: baur went from 14% imageSrc
coverage to 100% just by turning that on. The Sec-CH-UA client hints
helped some Cloudflare-fronted shops, though it's not a silver bullet
(Cloudflare still blocks others — see "known limitations").

## Live crawl flow

### `POST /api/crawl`

Source: [`server/api/crawl/index.post.ts`](server/api/crawl/index.post.ts).

Body shape:

```ts
{
  query: string         // user's search term
  locale: Locale        // 'de' | 'en'
  slug?: string         // single-store override (test path)
  categories?: string[] // narrow the fan-out, e.g. ['categories.electronics']
}
```

The handler:

1. Pulls `cachedStores('germany')` — the merged Satsback API list + the
   override file (24h TTL in prod, 5s in dev).
2. Filters to `crawl.crawlable && crawl.searchUrl && crawl.schema`.
3. If `slug` is set, that single store; else if `categories` is set,
   stores whose `category` matches one of them; else all crawlable
   stores.
4. For each target store:
   - Builds the search URL by replacing the literal `"ipad"` placeholder
     in `crawl.searchUrl` with the URL-encoded query.
   - Appends a `?p=2` (or shop-specific) param if `crawl.paging.pageQueryParam`
     is set; otherwise injects a load-more-click JS script if
     `crawl.paging.loadMoreSelector` is set.
   - POSTs `/crawl/job` to Crawl4AI with the stored schema and a webhook
     callback to `/api/crawl/webhook`. Headers carry slug/group/category
     for the webhook to attach to the Algolia record.

### Frontend category inference

[`ResultHits.vue`](app/components/search/ResultHits.vue) has a small
keyword → categories map covering the categories we have schemas for
(electronics, fashion, shoes, food, beauty, fitness, furniture,
household, supplements, energy). When the user searches "fernseher", we
infer `categories.electronics` and pass it in the `categories` body
field. Unmatched queries pass no filter and fall through to crawling
every shop (current default — costs Crawl4AI calls but small while the
crawlable set is ~14 shops).

There's also a category dropdown on the search bar
(`<AisMenuSelect attribute="category">`) backed by Algolia faceting, so
users can narrow proactively before typing.

### `/api/crawl/webhook` — what happens after Crawl4AI finishes

Source: [`server/api/crawl/webhook.post.ts`](server/api/crawl/webhook.post.ts).

Steps:

1. Validate the `X-Webhook-Secret` header against `CRAWL_WEBHOOK_SECRET`.
2. Parse `extracted_content` JSON arrays into `CrawledItem[]`.
3. **`imageAlt → name` fallback**: any item with empty `name` but
   non-empty `imageAlt` adopts the alt text.
4. **Model extraction**: many German shops render the manufacturer's
   article number inside chevron quotes in the product name,
   e.g. `Toaster »TSF02CREU« 2 lange Schlitze`. Regex-extract that into
   `item.model`. Surfaced in the UI as a "search this on the shop"
   copy-helper.
5. **Price normalization**: Shopify themes emit screen-reader labels
   inside the price element ("Verkaufspreis59,95 €Normaler Preis150,00").
   Strip known labels, collapse whitespace, pick the first complete
   currency token. For sale items that gives the sale price (the one
   the user pays).
6. **Empty-result branch**: if items are empty AND the upstream Crawl4AI
   `status === 'completed'`, log a warning but don't fire a Slack alert
   — that's a legitimate "user search returned 0 hits on this shop"
   outcome, not a failure mode.
7. Map to `AlgoliaProduct[]`. Compute `objectID = ${domain}-${name-slug}`
   (or `-${name-slug}-${description-slug}` if description is present).
8. Resolve relative `productUrl` values to absolute URLs using the
   crawled search URL's origin (NOT the slug — that was a bug; the slug
   is `baur` not `baur.de`).
9. Either `upsetAlgoliaObjects` (if `CRAWL_UPLOAD_AUTOMATIC=true`) or
   stash in Vercel Blob and ping Slack for a manual approve in
   `app/pages/internal/approve-crawl.vue`.

## Data structures

### `server/data/store-overrides.json`

Single source of truth for per-shop crawl config. Generated by
`pnpm stores:sync` from the colleague's CSV exports. Per slug:

```jsonc
{
  "baur": {
    "category": "categories.retail",
    "url": "https://www.baur.de",
    "crawl": {
      "searchUrl": "https://www.baur.de/s/ipad",
      "cms": "",
      "crawlable": true,
      "schema": {
        "type": "dict",
        "value": {
          "baseSelector": "li.product-card",
          "fields": [
            { "name": "name", "selector": ".product-card-name", "type": "text" },
            { "name": "productUrl", "selector": ".product-card-name", "type": "attribute", "attribute": "href" },
            // ...
          ]
        }
      },
      "paging": {
        "loadMoreSelector": "main > div:nth-child(6) > ... > button",
        "pageQueryParam": "p"
      },
      "sampleQuery": "racket"       // optional, niche shops only
    }
  }
}
```

Field types are declared in [`types/types.d.ts`](types/types.d.ts) as
`StoreCrawlData` / `CrawlSchema` / `CrawlPaging`.

### `AlgoliaProduct`

What lands in the index (defined in [`types/algolia.d.ts`](types/algolia.d.ts)):

```ts
{
  name: string                  // imageAlt-fallback applies before write
  productUrl: string            // absolute; relative paths resolved server-side
  brand: string
  description?: string
  price?: string                // normalized; may be missing — frontend has a fallback
  imageSrc?: string
  imageAlt?: string
  imageSrcset?: string
  model?: string                // extracted from »…« in name
  shopDomain: string            // slug, not hostname
  group: string                 // 'satsback' | 'payWithBitcoin'
  category?: string             // i18n key, e.g. 'categories.electronics'
  colors?: string
  objectID: string              // `${domain}-${name-slug}`
}
```

`category` is a facet (must be in Algolia `attributesForFaceting`) and
backs the prefix-dropdown category filter.

## Scripts and tools

| Command | What it does |
|---|---|
| `pnpm gen:schema <slug>` | Generate a CSS schema for one shop via Gemini. Writes to `tmp/schemas/<slug>.json`. Verbose. |
| `pnpm gen:schema slug1 slug2 …` | Batch mode. Writes a `_summary.json`. |
| `pnpm save:schema <slug>` | Persist a generated schema from `tmp/schemas/` into `store-overrides.json`. Skips ones where the LLM declined. |
| `pnpm save:schema --all` | Persist every generated schema. |
| `pnpm stores:disable-missing` | Dry-run: list crawlable overrides not in the live Satsback catalog. |
| `pnpm stores:disable-missing --apply` | Flip `crawl.crawlable: false` and append a comment. Saves `tmp/missing-stores-<date>.json`. |
| `pnpm algolia:purge-disabled` | Dry-run: how many Algolia records belong to disabled shops. |
| `pnpm algolia:purge-disabled --apply` | Delete those records via `deleteByQuery`. Chunked. |
| `pnpm probe:jsonld` | Earlier exploration tool — sitemap + JSON-LD probe. Not load-bearing; kept for reference. |

## Cron jobs

[`vercel.json`](vercel.json):

| Path | Schedule | Purpose |
|---|---|---|
| `/api/cron/check-satsback-stores` | `0 4 * * *` (daily, 04:00 UTC) | Diff overrides against Satsback API; Slack-alert about shops we still mark crawlable that no longer exist upstream. |
| `/api/cron/purge-disabled-algolia-records` | `0 5 * * *` (daily, 05:00 UTC) | For every `crawl.crawlable: false` slug, delete matching `shopDomain` records from Algolia. Slack a summary. |

Both endpoints authenticate via `Authorization: Bearer ${CRON_SECRET}`.
Vercel cron injects the bearer automatically when `CRON_SECRET` is in
project env; the routes refuse all requests when the env is unset.

`shopinbit` is `unshift`ed into `cachedStores()` (it's not in the
Satsback partner catalog), so the cron explicitly excludes it from the
"missing" diff to avoid a permanent false positive.

## Known limitations

- **Cloudflare-fronted shops.** `simulate_user` + `override_navigator` +
  `Sec-CH-UA*` headers are not enough for a handful of shops (24mx-2,
  3ppp3 in our sample). They'd need a residential proxy or a stealth
  Playwright integration in Crawl4AI. The LLM correctly declines those
  pages today, so they're not failing silently — just not crawling.
- **`window.nostr` extension is desktop-only.** Mobile users can't get
  satsback cashback via the existing flow. There's a graceful fallback
  modal (`product.noCashback.*` i18n keys) that opens the product URL
  directly. NIP-46 (Nostr Connect) would be the proper mobile path —
  not built yet.
- **No retry-on-stale-data.** If Satsback rotates a `store_id` mid-day,
  the local `cachedStores` cache holds the old value for up to 24 h. The
  redirect 404s; the frontend shows the `cashbackUnavailable` toast and
  opens the product URL directly. Self-healing (invalidate the cache on
  404 + retry) is a candidate enhancement but not currently in place.
- **Category inference is keyword-based and incomplete.** Queries with
  no keyword match fall through to crawling every shop. Acceptable while
  the crawlable set is small; will matter more as it grows.

## Important gotchas / wisdom

1. **`crawl.searchUrl` template placeholder is the literal string
   `"ipad"`.** Spelled lowercase. The colleague chose it because it's an
   uncommon word unlikely to appear elsewhere in URLs (verified against
   the sample). Case-sensitive substitution.

2. **`shopDomain` is a slug, not a hostname.** E.g. `baur`, not
   `baur.de`. The webhook builds absolute `productUrl` values from the
   crawled search URL's origin instead.

3. **`useStores()` is the single source of truth for live store
   metadata.** `store_id` (Satsback's short ID) comes from the API and
   shouldn't be cached on Algolia records — that would introduce a
   second source of truth that goes stale on rotation.

4. **Cookie TTLs**: `satsback_token` is 1h, `satsback_user_id` is 30d.
   Stale-userId scenarios are theoretically possible but the userId is
   derived from `satsback_user_id` (the short Satsback-internal ID),
   which is stable per Nostr pubkey. The `/api/satsback/redirect`
   endpoint requires a Bearer token forwarded upstream — without it,
   Satsback 404s.

5. **The frontend always has a fallback URL**. `ProductCard.vue`'s
   `resolveFallbackUrl()` tries `product.sourceUrl`, then a substituted
   shop search URL (using the same `"ipad"` template), then the shop
   homepage from overrides. Never opens `about:blank` from an undefined
   `sourceUrl` — that was a real bug.

## Files at a glance

```
scripts/
  generate-css-schema.mjs       # LLM-driven schema generation
  save-schema.mjs               # tmp/schemas → store-overrides.json
  disable-missing-stores.mjs    # ad-hoc, mirrors the cron diff
  purge-disabled-algolia-records.mjs   # ad-hoc Algolia cleanup
  sync-stores.mjs               # CSV → overrides + i18n (pre-existing)
  probe-jsonld.mjs              # earlier exploration, retained

server/
  api/
    crawl/
      index.post.ts             # fan-out endpoint, /api/crawl
      webhook.post.ts           # ingest Crawl4AI results, normalize, upsert Algolia
      approve.post.ts           # manual-upload path
      decline.post.ts
    cron/
      check-satsback-stores.get.ts
      purge-disabled-algolia-records.get.ts
    satsback/
      redirect.post.ts          # /store/visit/... proxy (forwards Bearer)
      get-token.post.ts         # returns { userId: satsback_user_id, token }
      create-user.post.ts
      user/                     # clicks, history, payouts
  data/
    store-overrides.json        # source of truth — crawl config per shop
    categories.json             # generated by stores:sync
  lib/
    algolia.ts                  # getClient, upsetAlgoliaObjects
    send-slack-message.ts
  middleware/
    auth.ts                     # extracts Authorization → event.context.authToken
  utils/
    stores.ts                   # cachedStores(country), merges API + overrides

app/
  components/search/
    Filter.vue                  # group / brand / colors refinements
    ProductCard.vue             # order click, satsback modal, fallback URLs
    ResultHits.vue              # triggers /api/crawl on 0 hits, category inference
    DebouncedSearchBox.vue
  composables/
    useSatsbackApi.ts           # ensureAuth, getStoreLink, browser detect
    useSatsbackUserId.ts        # cookie + useState mirror
    useSatsbackToken.ts
    useStores.ts                # wraps /api/stores
  pages/
    search.vue                  # AisInstantSearch + category prefix dropdown
    internal/
      approve-crawl.vue         # manual-approval form
      test.vue                  # satsback API playground

types/
  algolia.d.ts                  # AlgoliaProduct
  crawler.ts                    # Crawl4AI request/webhook shapes
  satsback.d.ts                 # GetTokenResponse, VisitStoreResponse, history items
  types.d.ts                    # Store, StoreCrawlData, CrawlSchema, CrawlPaging

vercel.json                     # cron schedules
nuxt.config.ts                  # runtimeConfig (CRAWL4AI_URL, CRON_SECRET, …)
```

## Quick test recipe

To verify the pipeline end-to-end locally:

```bash
# 1. Make sure Crawl4AI is running locally (default http://localhost:11235).
docker ps | grep crawl4ai

# 2. Start the Nuxt dev server.
pnpm dev   # listens on :3000

# 3. Generate a schema for one shop (Gemini call + Crawl4AI validation).
pnpm gen:schema baur

# 4. Persist into overrides.
pnpm save:schema baur

# 5. Fire a crawl for a real query.
curl -X POST http://localhost:3000/api/crawl \
  -H "Content-Type: application/json" \
  -d '{"query":"toaster","locale":"de","slug":"baur"}'

# 6. Watch the dev log: Crawl4AI fetches, webhook lands, items
#    upsert into Algolia.

# 7. Confirm Algolia has the records:
node -e '
  const fs = require("fs")
  const env = Object.fromEntries(fs.readFileSync(".env", "utf8")
    .split(/\r?\n/).filter(l => l.includes("="))
    .map(l => { const [k, ...v] = l.split("="); return [k.trim(), v.join("=").trim()] }))
  fetch(`https://${env.ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/${env.ALGOLIA_PRODUCT_INDEX}/query`, {
    method: "POST",
    headers: { "X-Algolia-API-Key": env.ALGOLIA_SEARCH_API_KEY, "X-Algolia-Application-Id": env.ALGOLIA_APP_ID, "Content-Type": "application/json" },
    body: JSON.stringify({ params: "query=toaster&hitsPerPage=3" })
  }).then(r => r.json()).then(j => console.log(j.hits))
'
```

If Crawl4AI runs with `--network=host` on macOS Docker, `localhost`
inside the container reaches the host's localhost, so
`BASE_URL=http://localhost:3000` in `.env` works directly. Otherwise use
`host.docker.internal:3000` and add it to Vite's `allowedHosts` (Vite's
default host check 403s non-localhost POSTs to the dev server).
