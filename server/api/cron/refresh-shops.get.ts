import { cachedStores } from '~~/server/utils/stores'
import sendSlackMessage from '~~/server/lib/send-slack-message'

// Representative queries per category. We fire `/api/crawl` once per
// (shop, query) so the webhook's upsert path refreshes lastCrawledAt for
// every product that's still listed. Drift (price/image/stock) is
// handled for free by the partial-update behaviour of upsetAlgoliaObjects.
//
// Keep the lists short — 1–3 broad queries per category is enough to
// hit a representative slice of each shop's catalogue. Anything not
// surfaced by these queries ages out via the eviction cron (Piece 3).
const QUERIES_PER_CATEGORY: Record<string, string[]> = {
  'categories.electronics': ['laptop', 'kopfhörer'],
  'categories.fashion': ['shirt', 'jeans'],
  'categories.shoes': ['sneaker'],
  'categories.food': ['kaffee', 'wein'],
  'categories.beauty': ['parfum'],
  'categories.cosmetics': ['creme'],
  'categories.fitness': ['fitness'],
  'categories.furniture': ['sofa'],
  'categories.household': ['toaster'],
  'categories.supplements': ['vitamin'],
  'categories.energy': ['strom'],
  'categories.retail': ['geschenk'],
  'categories.books': ['buch'],
  'categories.gaming': ['playstation'],
  'categories.baby': ['baby'],
  'categories.coffee': ['kaffee'],
}
const DEFAULT_QUERIES = ['geschenk']

const SLACK_LIST_CAP = 50

/**
 * Per-shop refresh: re-runs the user-facing crawl pipeline against a small
 * set of representative queries per shop. The webhook's upsert path takes
 * care of stamping a fresh `lastCrawledAt` on everything still listed,
 * along with any price / image / stock drift.
 *
 * Run weekly via vercel.json so we're not hammering Crawl4AI or the shops.
 * Per-shop products not surfaced by these queries age out via the
 * eviction cron — that's the intentional tradeoff documented in
 * memory/algolia_refresh_plan.md.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  const expected = config.cronSecret ? `Bearer ${config.cronSecret}` : null
  if (!expected || getHeader(event, 'authorization') !== expected) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const stores = await cachedStores('germany')
  let crawlable = stores.filter(s => s.crawl?.crawlable && s.crawl.searchUrl && s.crawl.schema)

  // `?slug=<shop>` lets you smoke-test the refresh against a single shop
  // without triggering the full per-shop fan-out. Omit to refresh all.
  const querySlug = getQuery(event).slug
  if (typeof querySlug === 'string' && querySlug) {
    crawlable = crawlable.filter(s => s.slug === querySlug)
    if (crawlable.length === 0) {
      throw createError({ statusCode: 404, statusMessage: `No crawlable shop with slug "${querySlug}"` })
    }
  }

  const results: { slug: string, queries: string[], failedQueries: { query: string, reason: string }[] }[] = []
  for (const store of crawlable) {
    const queries = QUERIES_PER_CATEGORY[store.category] ?? DEFAULT_QUERIES
    const failed: { query: string, reason: string }[] = []
    for (const query of queries) {
      try {
        // Internal call to our own /api/crawl. config.baseUrl points at
        // the deployed URL; we hit it like an external client so we go
        // through the full validation + Slack-notify path.
        await $fetch(`${config.baseUrl}/api/crawl`, {
          method: 'POST',
          body: { query, locale: 'de', slug: store.slug },
        })
      }
      catch (err) {
        const reason = (err as Error).message ?? 'unknown'
        console.warn(`[refresh-shops] ${store.slug} query="${query}" failed: ${reason}`)
        failed.push({ query, reason: reason.slice(0, 80) })
      }
    }
    results.push({ slug: store.slug, queries, failedQueries: failed })
  }

  const totalJobs = results.reduce((a, r) => a + r.queries.length, 0)
  const totalFailed = results.reduce((a, r) => a + r.failedQueries.length, 0)
  const shown = results.slice(0, SLACK_LIST_CAP)
  const overflow = results.length - shown.length

  const body = shown.map(r =>
    `- ${r.slug} (${r.queries.join(', ')})${r.failedQueries.length > 0 ? ` ⚠ ${r.failedQueries.length} failed` : ''}`,
  ).join('\n') + (overflow > 0 ? `\n…and ${overflow} more` : '')

  await sendSlackMessage(config.slackWebhookUrl, {
    title: `:arrows_counterclockwise: Refresh: queued ${totalJobs} crawls across ${results.length} shop(s)${totalFailed > 0 ? ` (${totalFailed} submission errors)` : ''}`,
    richTextBody: body,
  })

  return {
    checkedAt: new Date().toISOString(),
    shopsRefreshed: results.length,
    totalJobsQueued: totalJobs,
    totalFailedSubmissions: totalFailed,
    results,
  }
})
