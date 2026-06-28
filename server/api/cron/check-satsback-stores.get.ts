import type { Store } from '~~/types/types'
import overridesJson from '~~/server/data/store-overrides.json'
import sendSlackMessage from '~~/server/lib/send-slack-message'

interface StoreOverride {
  category?: string
  url?: string
  crawl?: {
    crawlable?: boolean
    searchUrl?: string | null
    cms?: string
    comment?: string
    schema?: unknown
    paging?: unknown
    sampleQuery?: string
  }
}

// Slugs that are intentionally NOT in the Satsback API — we inject them
// in cachedStores() ourselves. Don't false-positive on these.
const STATIC_SLUGS = new Set(['shopinbit'])

// Cap how many slugs we list in the Slack message so we don't blow the
// block-size limit when the list is huge.
const SLACK_LIST_CAP = 50

// Periodic diff between `store-overrides.json` and the live Satsback
// catalog. Flags slugs that we still mark `crawl.crawlable: true` but
// that Satsback no longer returns — those are the shops whose
// `/store/visit/...` redirect will 404 for our users.
//
// Wire this to a scheduler (Vercel cron / Railway scheduler / GitHub
// Actions) and authenticate with `Authorization: Bearer ${CRON_SECRET}`.
// Manual invocation works too — handy when iterating on the override
// spreadsheet.
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  // Reject if the secret is unset (refuse to run an open endpoint) or
  // the request didn't present the right bearer.
  const expected = config.cronSecret ? `Bearer ${config.cronSecret}` : null
  if (!expected || getHeader(event, 'authorization') !== expected) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const liveStores = await $fetch<Store[]>(`https://satsback.com/api/v2/gospendl/stores/germany`)
    .catch((err) => {
      throw createError({
        statusCode: 502,
        statusMessage: `Satsback API unreachable: ${(err as Error).message}`,
      })
    })
  const liveSlugs = new Set(liveStores.map(s => s.slug))

  const overrides = overridesJson as Record<string, StoreOverride>
  const crawlable = Object.entries(overrides).filter(([, s]) => s.crawl?.crawlable)
  const missing: string[] = []
  for (const [slug] of crawlable) {
    if (STATIC_SLUGS.has(slug)) continue
    if (liveSlugs.has(slug)) continue
    missing.push(slug)
  }

  if (missing.length > 0) {
    const shown = missing.slice(0, SLACK_LIST_CAP)
    const overflow = missing.length - shown.length
    const body = shown.map(s => `- ${s}`).join('\n')
      + (overflow > 0 ? `\n…and ${overflow} more` : '')
      + '\n\nNext step: set `crawl.crawlable: false` in store-overrides.json for these slugs (or remove them entirely if the colleague confirms they\'re gone for good).'
    await sendSlackMessage(config.slackWebhookUrl, {
      title: `:warning: ${missing.length} crawlable shop(s) no longer in the Satsback catalog`,
      richTextBody: body,
    })
  }

  return {
    checkedAt: new Date().toISOString(),
    liveStoreCount: liveStores.length,
    crawlableOverrideCount: crawlable.length,
    missingCount: missing.length,
    missing,
  }
})
