import type { RunShopResult } from '~~/server/lib/crawl-run'
import { list } from '@vercel/blob'
import { runBlobPrefix } from '~~/server/lib/crawl-run'

export default defineEventHandler(async (event) => {
  const runId = getRouterParam(event, 'runId')
  if (!runId)
    throw createError({ statusCode: 400, statusMessage: 'runId is missing' })

  const { blobs } = await list({ prefix: runBlobPrefix(runId) })
  const shopBlobs = blobs.filter(b => b.pathname.endsWith('.json'))

  const shops = await Promise.all(shopBlobs.map(async (b) => {
    const res = await fetch(b.url)
    return res.json() as Promise<RunShopResult>
  }))

  shops.sort((a, b) => a.slug.localeCompare(b.slug))

  return { runId, shops }
})
