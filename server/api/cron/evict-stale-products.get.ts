import { getClient } from '~~/server/lib/algolia'
import sendSlackMessage from '~~/server/lib/send-slack-message'

const DEFAULT_OLDER_THAN_DAYS = 30
const SECONDS_PER_DAY = 86400

/**
 * Periodic TTL eviction: delete Algolia records whose `lastCrawledAt`
 * timestamp is older than the threshold. Pairs with
 * /api/cron/refresh-shops — anything still on a shop's listing gets
 * its `lastCrawledAt` bumped by the refresh; anything that doesn't
 * survives until the threshold and then ages out here.
 *
 * Default threshold is 30 days. Override per-request with
 * `?olderThanDays=N` if you want to dry-run with a stricter or looser
 * window (e.g. for a one-off cleanup).
 *
 * Authenticated by Authorization: Bearer ${CRON_SECRET} the same way
 * as the other crons.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  const expected = config.cronSecret ? `Bearer ${config.cronSecret}` : null
  if (!expected || getHeader(event, 'authorization') !== expected) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const query = getQuery(event)
  const raw = query.olderThanDays
  // Use ?? not || so ?olderThanDays=0 is honoured. Fractional values
  // (e.g. 0.0001 ≈ 8.6 seconds) are allowed for testing the eviction
  // window without waiting a day. Negative values are clamped at 0
  // because the endpoint is bearer-auth'd and "anything older than now"
  // is an explicit, intentional command.
  const parsed = raw === undefined || raw === null || raw === '' ? DEFAULT_OLDER_THAN_DAYS : Number(raw)
  if (!Number.isFinite(parsed)) {
    throw createError({ statusCode: 400, statusMessage: 'olderThanDays must be a finite number' })
  }
  const olderThanDays = Math.max(0, parsed)
  const threshold = Math.floor(Date.now() / 1000) - Math.floor(olderThanDays * SECONDS_PER_DAY)
  const filter = `lastCrawledAt < ${threshold}`

  const client = getClient(config)
  const indexName = config.public.algoliaProductIndex

  // Cheap pre-flight: count what we'd delete so the Slack summary has
  // useful numbers and so we can skip the deleteBy when nothing matches.
  const search = await client.searchSingleIndex<unknown>({
    indexName,
    searchParams: { filters: filter, hitsPerPage: 0 },
  })
  const recordsToDelete = search.nbHits ?? 0

  if (recordsToDelete === 0) {
    return {
      checkedAt: new Date().toISOString(),
      olderThanDays,
      thresholdTimestamp: threshold,
      recordsDeleted: 0,
    }
  }

  await client.deleteBy({ indexName, deleteByParams: { filters: filter } })

  await sendSlackMessage(config.slackWebhookUrl, {
    title: `:wastebasket: Evicted ${recordsToDelete} stale Algolia record(s) (older than ${olderThanDays}d)`,
    richTextBody: `Filter: \`${filter}\`\nDeletion is async on Algolia's side — the index reflects within a few seconds.`,
  })

  return {
    checkedAt: new Date().toISOString(),
    olderThanDays,
    thresholdTimestamp: threshold,
    recordsDeleted: recordsToDelete,
  }
})
