# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev               # Start dev server
pnpm build             # Production build
pnpm postinstall       # nuxt prepare (regenerates types, run after install)
pnpm stores:sync <cat.csv> <stores.csv>  # Import store + category data from Satsback Excel exports
```

No dedicated lint or test commands — linting is via ESLint (`eslint.config.mjs`), tests via `@nuxt/test-utils`.

## Architecture

**Nuxt 4** app with `app/` directory convention. Backend is Nitro (server-side rendering + API routes). Deployed on Railway/Vercel.

### Key flows

**Satsback affiliate auth (Nostr-based)**
Users authenticate via browser extensions (nos2x / Alby) that implement `window.nostr.signEvent()`. The flow:
1. `useSatsbackApi.ensureAuth()` — singleton-gated, deduplicates concurrent calls via `authInProgress: Promise | null`
2. Signs Nostr event kind 27237 → POST `/api/satsback/get-token` → returns `{ token, userId }`
3. Token stored in `useState('satsback_token')` (shared singleton) + persisted to cookie via `watch`
4. `app/plugins/satsback-fetch.client.ts` creates `$satsbackFetch` that injects `Authorization: Bearer <token>` on every request and clears token on 401

**Critical pattern — shared reactive state**: `useCookie` creates a new independent ref per call. Token and userId use `useState` as the reactive singleton plus a cookie watcher for persistence. See `useSatsbackToken.ts` and `useSatsbackUserId.ts`.

**Product search → affiliate link**
- Algolia powers the product search (`vue-instantsearch`). Products have a `shopDomain` field (slug format, e.g. `baur` not `baur.de`).
- `useStores()` fetches the live store list from `/api/stores` and is used to match products to stores by slug.
- When a user clicks a satsback-enabled product, `useSatsbackApi.getStoreLink(storeId)` is called after ensureAuth — this triggers Nostr auth on first use only.

**Crawl pipeline** (full reference: [CRAWL_PIPELINE.md](CRAWL_PIPELINE.md))

- `POST /api/crawl` fans out across shops, filtered by `crawl.crawlable && crawl.searchUrl && crawl.schema` in `store-overrides.json`, optionally narrowed by `categories: string[]` in the body. Per-store the handler substitutes the literal `"ipad"` placeholder in `crawl.searchUrl` with the user's URL-encoded query.
- Results come back via `POST /api/crawl/webhook` (secured by `CRAWL_WEBHOOK_SECRET`). Webhook normalises: `imageAlt → name` fallback (Shopify), model code extracted from `»…«` in the name, price stripped of screen-reader labels, relative `productUrl` resolved against the crawled search URL's origin.
- Per-shop CSS extraction schemas live under `crawl.schema` in `store-overrides.json`. Generate via `pnpm gen:schema <slug>` (Gemini Flash Lite + Crawl4AI validation against the shop's listing page), persist via `pnpm save:schema <slug>`. The generator's Crawl4AI config must mirror the production one (`scan_full_page`, `Sec-CH-UA*` headers, `cache_mode: BYPASS`) or schemas validated under the generator break in prod.
- Listing pages, not product detail, because listing cards are more uniform across shops. Always use Crawl4AI's raw `html` field (not `cleaned_html`) for the prompt — cleaned_html strips class names the LLM relies on.
- Hygiene crons (`vercel.json`): `/api/cron/check-satsback-stores` daily at 04:00 UTC diffs overrides against the live Satsback catalog and Slacks stale slugs; `/api/cron/purge-disabled-algolia-records` at 05:00 UTC deletes Algolia records for `crawl.crawlable: false` shops. Both auth via `Authorization: Bearer ${CRON_SECRET}`. Ad-hoc CLIs: `pnpm stores:disable-missing`, `pnpm algolia:purge-disabled` (dry-run by default, `--apply` to act).

**Server auth middleware**
`server/middleware/auth.ts` extracts `Authorization` header and stores in `event.context.authToken`. Server routes for `/api/satsback/user/*` use this to forward the token to the Satsback upstream API.

**Store + category management**
Store list and categories come from two CSV exports of the Satsback Excel sheet (colleague maintains):
1. **Categories CSV** — all available categories with i18nKeys and labels
2. **Germany CSV** — store list joined with manual curation: category assignments, official URLs, crawler metadata (`searchUrl`, `cms`, `crawlable`, `comment`)

The import flow:
- Place updated CSVs in any directory (e.g. colleague sends via email/Drive)
- Run `pnpm stores:sync <categories.csv> <germany.csv>`
- Script generates:
  - `server/data/categories.json` — committed list of active categories (pruned to only those with stores)
  - `server/data/store-overrides.json` — per-store overrides by slug
  - `i18n/locales/categories.{de,en}.json` — i18n keys for the UI filter
- Commit the generated files; CSVs stay local (git-ignored)
- On re-run, existing EN translations are preserved; new categories fall back to `SEED_EN` in the script or auto-titlecase
- Categories with zero stores are pruned and logged (colleague updates the Excel to remove them)

`server/utils/stores.ts` merges Satsback API data with overrides by slug → each store gets `category`, optional `url`, optional `crawl` metadata.

### Directory layout

```
app/
  composables/      # useSatsbackApi, useSatsbackToken, useSatsbackUserId, useStores
  components/search/# ProductCard (with satsback popup), StoreCard, ResultHits
  pages/internal/   # Playground pages (not for production users)
  plugins/          # satsback-fetch.client.ts
server/
  api/satsback/     # Proxy routes to Satsback API
  api/crawl/        # Crawl4AI integration
  data/             # Generated: categories.json, store-overrides.json (from pnpm stores:sync)
  lib/              # algolia.ts, send-slack-message.ts
  middleware/auth.ts
  utils/stores.ts   # Merges Satsback API data with store-overrides.json, 24h server cache
i18n/locales/       # Generated: categories.de.json, categories.en.json (from pnpm stores:sync)
scripts/
  sync-stores.mjs   # CSV importer: parses Categories + Germany CSVs, generates data files
types/              # satsback.d.ts, algolia.d.ts, crawler.ts
```

## Environment variables

| Variable | Purpose |
|---|---|
| `ALGOLIA_APP_ID` / `ALGOLIA_SEARCH_API_KEY` / `ALGOLIA_WRITE_API_KEY` | Algolia search + indexing |
| `ALGOLIA_PRODUCT_INDEX` | Index name for products |
| `NUXT_SLACK_WEBHOOK_URL` | Crawl approval notifications |
| `CRAWL4AI_URL` | Crawl4AI service URL |
| `CRAWL_WEBHOOK_SECRET` | Webhook auth |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob storage |
| `BASE_URL` | App base URL |

## Non-obvious patterns

- **`withAuth<T>(call)`** in `useSatsbackApi` wraps any API call with auth: `await ensureAuth(); return await call()`. Never add retry logic inside `withAuth` — the 401 path is handled in the plugin.
- **Server user routes** (`clicks`, `history`, `payouts`) must wrap the upstream `$fetch` in try/catch and rethrow with `createError({ statusCode })` — otherwise h3 returns 500 instead of 401.
- **Store data flow**: `cachedStores(country)` in `server/utils/stores.ts` fetches from Satsback API, merges in `store-overrides.json` by slug, defaults unmapped stores to `categories.other`. After CSV updates, restart the dev server (`rm -rf .nuxt && pnpm dev`) to reload the module and pick up new overrides.
- **Store shape**: `{ name, slug, group, image, description, category, url?, crawl? }` where `category` is the i18nKey (e.g. `categories.retail`), and `crawl` groups internal metadata: `{ searchUrl, cms, crawlable, comment? }`.
- **Store slugs in Algolia** must be in bare format (e.g. `baur`, not `baur.de`) to match `store.slug` from the Satsback store list.
- **i18n**: `de` is default locale. Route `/` is German; `/en` is English.
- **Nuxt UI components** use TanStack Table format for columns: `{ accessorKey, header }` — not the old `{ key, label }` format.
