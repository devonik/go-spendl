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
// catalog, in both directions:
//   - overrides with no live store (rotated slug vs genuinely delisted —
//     opposite fixes, so they're reported as separate lists)
//   - live stores with no override, which silently fall back to
//     `categories.other` and vanish from the category filter
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

  // The opposite direction, and the one that actually degrades the app: a live
  // store with no override row at all. `extendStores()` defaults it to
  // `categories.other`, so it drops out of every category filter silently —
  // no error, no log, nothing to notice. A stale override is inert by
  // comparison (nothing ever reads the key), so this list is the one worth
  // acting on first.
  const uncovered = liveStores
    .filter(s => !(s.slug in overrides))
    .map(s => ({ slug: s.slug, name: s.name }))
    .sort((a, b) => a.slug.localeCompare(b.slug))

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

  // The lists need different fixes, so they're reported separately —
  // telling someone to disable a merely-renamed shop takes a working,
  // still-partnered shop offline.
  if (renamed.length > 0 || gone.length > 0 || uncovered.length > 0) {
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
        'Next step: `pnpm stores:prune-delisted` (dry-run first) — it removes these and writes tmp/delisted-plan.csv for the Germany sheet, which has to lose the rows too or the next stores:sync restores them.',
      ].join('\n'))
    }

    if (uncovered.length > 0) {
      const shown = uncovered.slice(0, SLACK_LIST_CAP)
      const overflow = uncovered.length - shown.length
      sections.push([
        `*${uncovered.length} live store(s) with no override — falling back to \`categories.other\`*`,
        ...shown.map(u => `- \`${u.slug}\`${u.name ? ` — ${u.name}` : ''}`),
        ...(overflow > 0 ? [`…and ${overflow} more`] : []),
        '',
        'Next step: these need a category in the Germany sheet. Until then they are live and payable but invisible to the category filter.',
      ].join('\n'))
    }

    // Two independent problems, so the title counts them separately rather
    // than summing into one number that means nothing.
    const staleTotal = renamed.length + gone.length
    const headline = [
      staleTotal > 0 ? `${staleTotal} stale override(s)` : '',
      uncovered.length > 0 ? `${uncovered.length} uncovered live store(s)` : '',
    ].filter(Boolean).join(', ')

    await sendSlackMessage(config.slackWebhookUrl, {
      title: `:warning: Satsback catalog drift — ${headline}`,
      richTextBody: sections.join('\n\n'),
    })
  }

  return {
    checkedAt: new Date().toISOString(),
    liveStoreCount: liveStores.length,
    overrideCount: checked,
    renamedCount: renamed.length,
    goneCount: gone.length,
    uncoveredCount: uncovered.length,
    renamed,
    gone,
    uncovered,
  }
})
