import overridesJson from '~~/server/data/store-overrides.json'
import { getClient } from '~~/server/lib/algolia'
import sendSlackMessage from '~~/server/lib/send-slack-message'

interface StoreOverride {
  crawl?: { crawlable?: boolean }
}

// Chunk so we don't push the filter string toward Algolia's request-size limit.
const CHUNK = 100
const SLACK_LIST_CAP = 50

/**
 * Periodic Algolia hygiene: delete records whose shopDomain matches a
 * slug we've already disabled (`crawl.crawlable: false`) in
 * store-overrides.json. Pairs with /api/cron/check-satsback-stores —
 * the satsback check alerts about new dead shops; once a human flips
 * those entries to crawlable: false (e.g. via
 * `pnpm stores:disable-missing --apply`) and re-deploys, this cron
 * cleans the matching records out of the index on the next run.
 *
 * Authenticated by Authorization: Bearer ${CRON_SECRET} the same way
 * as the satsback check.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  const expected = config.cronSecret ? `Bearer ${config.cronSecret}` : null
  if (!expected || getHeader(event, 'authorization') !== expected) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const overrides = overridesJson as Record<string, StoreOverride>
  const disabledSlugs = Object.entries(overrides)
    .filter(([, s]) => s.crawl?.crawlable === false)
    .map(([slug]) => slug)

  const client = getClient(config)
  const indexName = config.public.algoliaProductIndex

  // One faceted search call sizes the delete — cheaper than fetching every
  // record matching the filter just to count them.
  const facetSearch = await client.searchSingleIndex<unknown>({
    indexName,
    searchParams: { facets: ['shopDomain'], hitsPerPage: 0, maxValuesPerFacet: 1000 },
  })
  const facets = (facetSearch.facets?.shopDomain ?? {}) as Record<string, number>

  const toDelete = disabledSlugs
    .map(slug => ({ slug, count: facets[slug] || 0 }))
    .filter(s => s.count > 0)
  const totalRecords = toDelete.reduce((a, s) => a + s.count, 0)

  if (toDelete.length === 0) {
    return {
      checkedAt: new Date().toISOString(),
      disabledSlugCount: disabledSlugs.length,
      shopsWithRecords: 0,
      recordsDeleted: 0,
    }
  }

  for (let i = 0; i < toDelete.length; i += CHUNK) {
    const chunk = toDelete.slice(i, i + CHUNK)
    const filter = chunk.map(s => `shopDomain:"${s.slug}"`).join(' OR ')
    await client.deleteBy({ indexName, deleteByParams: { filters: filter } })
  }

  const shown = toDelete.slice(0, SLACK_LIST_CAP)
  const overflow = toDelete.length - shown.length
  const body = shown.map(s => `- ${s.slug} (${s.count})`).join('\n')
    + (overflow > 0 ? `\n…and ${overflow} more` : '')
  await sendSlackMessage(config.slackWebhookUrl, {
    title: `:broom: Purged ${totalRecords} Algolia record(s) across ${toDelete.length} disabled shop(s)`,
    richTextBody: body,
  })

  return {
    checkedAt: new Date().toISOString(),
    disabledSlugCount: disabledSlugs.length,
    shopsWithRecords: toDelete.length,
    recordsDeleted: totalRecords,
  }
})
