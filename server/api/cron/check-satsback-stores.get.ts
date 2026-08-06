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

// Satsback slugs carry a trailing numeric suffix that rotates: the same
// shop came back as `sixt-2` after we had recorded `sixt-6`, and
// `getyourguide-8` after `getyourguide-14` (it moves in both directions,
// so it isn't a version counter). A rotated slug is NOT a delisting — the
// shop is still in the catalog and still pays out — but the override no
// longer matches it, which is why the two cases need opposite fixes.
function slugBase(slug: string): string {
  return slug.replace(/-\d+$/, '')
}

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

  // Index the live catalog by slug base so a rotated suffix is resolvable.
  const liveByBase = new Map<string, string[]>()
  for (const slug of liveSlugs) {
    const base = slugBase(slug)
    const bucket = liveByBase.get(base)
    if (bucket)
      bucket.push(slug)
    else
      liveByBase.set(base, [slug])
  }

  const overrides = overridesJson as Record<string, StoreOverride>
  // Check *every* override, not just the crawlable ones. `extendStores()`
  // merges overrides by slug, so a stale slug silently drops that store back
  // to `categories.other` and loses its curated `url` — the category filter
  // degrades with no error anywhere. Only looking at crawlable entries hid
  // the large majority of these.
  const renamed: { slug: string, candidates: string[], crawlable: boolean }[] = []
  const gone: { slug: string, crawlable: boolean }[] = []
  let checked = 0
  for (const [slug, store] of Object.entries(overrides)) {
    if (STATIC_SLUGS.has(slug))
      continue
    checked++
    if (liveSlugs.has(slug))
      continue
    const crawlable = Boolean(store.crawl?.crawlable)
    const candidates = (liveByBase.get(slugBase(slug)) ?? []).filter(c => c !== slug)
    if (candidates.length > 0)
      renamed.push({ slug, candidates, crawlable })
    else
      gone.push({ slug, crawlable })
  }

  // The two lists need opposite fixes, so they're reported separately —
  // telling someone to disable a merely-renamed shop takes a working,
  // still-partnered shop offline.
  if (renamed.length > 0 || gone.length > 0) {
    const mark = (crawlable: boolean) => crawlable ? ' *(crawlable)*' : ''
    const sections: string[] = []

    if (renamed.length > 0) {
      const shown = renamed.slice(0, SLACK_LIST_CAP)
      const overflow = renamed.length - shown.length
      sections.push([
        `*${renamed.length} slug(s) rotated — the shop is still live, do NOT disable*`,
        ...shown.map(r => `- \`${r.slug}\` → \`${r.candidates.join('` or `')}\`${mark(r.crawlable)}`),
        ...(overflow > 0 ? [`…and ${overflow} more`] : []),
        '',
        'Next step: rename the key in store-overrides.json (keep its category, url and crawl block).',
      ].join('\n'))
    }

    if (gone.length > 0) {
      const shown = gone.slice(0, SLACK_LIST_CAP)
      const overflow = gone.length - shown.length
      sections.push([
        `*${gone.length} slug(s) with no live match — likely delisted*`,
        ...shown.map(g => `- \`${g.slug}\`${mark(g.crawlable)}`),
        ...(overflow > 0 ? [`…and ${overflow} more`] : []),
        '',
        'Next step: set `crawl.crawlable: false` (or remove the entry once the colleague confirms it\'s gone for good).',
      ].join('\n'))
    }

    const staleTotal = renamed.length + gone.length
    await sendSlackMessage(config.slackWebhookUrl, {
      title: `:warning: ${staleTotal} store override(s) no longer match the Satsback catalog`,
      richTextBody: sections.join('\n\n'),
    })
  }

  return {
    checkedAt: new Date().toISOString(),
    liveStoreCount: liveStores.length,
    overrideCount: checked,
    renamedCount: renamed.length,
    goneCount: gone.length,
    renamed,
    gone,
  }
})
