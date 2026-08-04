import type { AlgoliaProduct } from '~~/types/algolia'
import { list, put } from '@vercel/blob'
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

  await put(shopResultBlobPath(runId, result.slug, result.status), JSON.stringify(result), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
  })

  const { blobs } = await list({ prefix: runBlobPrefix(runId) })
  const shopBlobs = blobs.filter(b => b.pathname.endsWith('.json'))
  if (shopBlobs.length < runTotal)
    return

  const lockPath = summaryLockBlobPath(runId)
  if (blobs.some(b => b.pathname === lockPath))
    return
  await put(lockPath, 'locked', { access: 'public', addRandomSuffix: false })

  const results = await Promise.all(shopBlobs.map(async (b) => {
    const res = await fetch(b.url)
    return res.json() as Promise<RunShopResult>
  }))

  const ok = results.filter(r => r.status === 'ok' && r.itemCount > 0)
  const empty = results.filter(r => r.status === 'ok' && r.itemCount === 0)
  const failed = results.filter(r => r.status === 'failed')
  const totalItems = ok.reduce((sum, r) => sum + (r.itemCount || 0), 0)
  const pendingApproval = ok.filter(r => r.mode === 'approval' && r.itemCount > 0)

  // Slack mrkdwn: `<url|label>` renders as a clickable link, `\n` breaks the
  // line inside a section. Anything without a searchUrl falls back to a plain
  // slug so we never link to `<undefined|slug>`.
  const linkify = (r: RunShopResult) => r.searchUrl ? `<${r.searchUrl}|${r.slug}>` : r.slug
  const emptyBlock = empty.length ? `\n\n*Empty:*\n${empty.map(r => `• ${linkify(r)}`).join('\n')}` : ''
  const failedBlock = failed.length ? `\n\n*Failed:*\n${failed.map(r => `• ${linkify(r)}: ${r.error || 'unknown error'}`).join('\n')}` : ''
  const title = `:checkered_flag: Run ${runId}: ${ok.length} ok (${totalItems} items), ${empty.length} empty, ${failed.length} failed${emptyBlock}${failedBlock}`

  await sendSlackMessage(slackWebhookUrl, {
    title,
    ...(pendingApproval.length ? { approveUploadActionUrl: `${baseUrl}/internal/approve-crawl?runId=${runId}` } : {}),
  })
}
