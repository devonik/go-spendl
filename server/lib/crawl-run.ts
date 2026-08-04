import type { AlgoliaProduct } from '~~/types/algolia'
import { del, list, put } from '@vercel/blob'
import sendSlackMessage from './send-slack-message'

export interface RunShopResult {
  slug: string
  status: 'ok' | 'failed'
  /** 'auto' shops are already upserted into Algolia — nothing left to approve. */
  mode: 'auto' | 'approval'
  itemCount: number
  error?: string
  initialQuery?: string
  /**
   * Actual URL Crawl4AI hit — surfaced in the Slack summary so empty/failed
   * shops can be inspected in one click.
   */
  searchUrl?: string
  /** Only set for mode: 'approval' with itemCount > 0. */
  items?: AlgoliaProduct[]
}

export function runBlobPrefix(runId: string): string {
  return `crawl/runs/${runId}/`
}

export function shopResultBlobPath(runId: string, slug: string, status: RunShopResult['status']): string {
  return `${runBlobPrefix(runId)}${slug}${status === 'failed' ? '.error' : ''}.json`
}

function summaryLockBlobPath(runId: string): string {
  return `${runBlobPrefix(runId)}_summary-sent.lock`
}

/**
 * Persists one shop's crawl outcome into the run's blob folder. Once every
 * shop dispatched in the run has written its result, fires a single Slack
 * summary for the whole run instead of one message per shop.
 *
 * Two webhooks racing to conclude "I'm the last one" is mitigated with a
 * lock blob written right before the summary is sent; worst case is two
 * summary messages (checked-but-not-atomic), never lost or duplicated data —
 * see CRAWL_RUN_APPROVAL_PLAN.md.
 */
export async function recordShopResult(opts: {
  runId: string
  runTotal: number
  slackWebhookUrl: string
  baseUrl: string
  result: RunShopResult
}): Promise<void> {
  const { runId, runTotal, slackWebhookUrl, baseUrl, result } = opts
  const lockPath = summaryLockBlobPath(runId)

  // Straggler check: if the summary lock is already there, this run has been
  // wrapped up (and its folder likely purged). A late Crawl4AI retry must not
  // repopulate the folder — otherwise a full re-fanout of retries could reach
  // runTotal again and re-fire the summary. Ignore it entirely.
  const preBlobs = (await list({ prefix: runBlobPrefix(runId) })).blobs
  if (preBlobs.some(b => b.pathname === lockPath))
    return

  // allowOverwrite so Crawl4AI webhook retries for the same shop (same
  // runId + slug + status) update the entry instead of crashing the handler
  // — the latest attempt is the truth.
  await put(shopResultBlobPath(runId, result.slug, result.status), JSON.stringify(result), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  })

  // Re-list to include our just-written blob (and to catch the overwrite case
  // where the preBlobs snapshot already contained our slug).
  const { blobs } = await list({ prefix: runBlobPrefix(runId) })
  const shopBlobs = blobs.filter(b => b.pathname.endsWith('.json'))
  if (shopBlobs.length < runTotal)
    return

  // Lock race handling: the check above isn't atomic, so two webhooks may both
  // pass and both try to write. put() throws when the blob exists (no
  // allowOverwrite here — the throw itself IS the race signal), so the loser
  // silently bails and only the winner sends the summary.
  if (blobs.some(b => b.pathname === lockPath))
    return
  try {
    await put(lockPath, 'locked', { access: 'public', addRandomSuffix: false })
  }
  catch {
    return
  }

  const results = await Promise.all(shopBlobs.map(async (b) => {
    const res = await fetch(b.url)
    return res.json() as Promise<RunShopResult>
  }))

  const ok = results.filter(r => r.status === 'ok' && r.itemCount > 0)
  const empty = results.filter(r => r.status === 'ok' && r.itemCount === 0)
  const failed = results.filter(r => r.status === 'failed')
  const totalItems = ok.reduce((sum, r) => sum + (r.itemCount || 0), 0)
  const pendingApproval = ok.filter(r => r.mode === 'approval' && r.itemCount > 0)

  // The user's search query is stamped on every shop result, but failed shops
  // may lack it — read from the first result that has it. All shops in a run
  // fan out from the same search, so any is representative.
  const initialQuery = results.find(r => r.initialQuery)?.initialQuery
  const queryLabel = initialQuery ? ` for "${initialQuery}"` : ''

  // Slack mrkdwn: `<url|label>` renders as a clickable link, `\n` breaks the
  // line inside a section. Anything without a searchUrl falls back to a plain
  // slug so we never link to `<undefined|slug>`.
  const linkify = (r: RunShopResult) => r.searchUrl ? `<${r.searchUrl}|${r.slug}>` : r.slug
  const emptyBlock = empty.length ? `\n\n*Empty:*\n${empty.map(r => `• ${linkify(r)}`).join('\n')}` : ''
  const failedBlock = failed.length ? `\n\n*Failed:*\n${failed.map(r => `• ${linkify(r)}: ${r.error || 'unknown error'}`).join('\n')}` : ''
  const title = `:checkered_flag: Run ${runId}${queryLabel}: ${ok.length} ok (${totalItems} items), ${empty.length} empty, ${failed.length} failed${emptyBlock}${failedBlock}`

  await sendSlackMessage(slackWebhookUrl, {
    title,
    ...(pendingApproval.length ? { approveUploadActionUrl: `${baseUrl}/internal/approve-crawl?runId=${runId}` } : {}),
  })

  // Auto mode has nothing left to approve, so we can reclaim the folder now.
  // Approval mode purges after the user has decided on the last shop (see
  // purgeRunFolderIfDone). Either way the lock survives so late webhook
  // retries can't re-fire the summary.
  if (!pendingApproval.length)
    await purgeRunFolder(runId, { keepLock: true })
}

/**
 * Deletes every blob under a run's folder. Pass `keepLock: true` to retain
 * the summary-sent marker — required whenever the run may still be reached
 * by late Crawl4AI webhook retries, so the straggler check in
 * recordShopResult stays authoritative.
 */
export async function purgeRunFolder(runId: string, opts?: { keepLock?: boolean }): Promise<void> {
  const { blobs } = await list({ prefix: runBlobPrefix(runId) })
  const lockPath = summaryLockBlobPath(runId)
  const toDelete = opts?.keepLock ? blobs.filter(b => b.pathname !== lockPath) : blobs
  if (toDelete.length > 0)
    await del(toDelete.map(b => b.url))
}

/**
 * Purges the run folder (keeping the lock) once no shop still has items
 * waiting on a decision — i.e., every ok+items shop has been approved or
 * declined. No-op while any pending approval remains.
 */
export async function purgeRunFolderIfDone(runId: string): Promise<void> {
  const { blobs } = await list({ prefix: runBlobPrefix(runId) })
  const actionable = blobs.filter(b => b.pathname.endsWith('.json') && !b.pathname.endsWith('.error.json'))
  for (const b of actionable) {
    const res = await fetch(b.url)
    const shop = await res.json() as RunShopResult
    if (shop.items && shop.items.length > 0)
      return
  }
  await purgeRunFolder(runId, { keepLock: true })
}
