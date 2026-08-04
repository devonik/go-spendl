import type { AlgoliaProduct } from '~~/types/algolia'
import { Redis } from '@upstash/redis'
import { del } from '@vercel/blob'
import { upsetAlgoliaObjects } from '../../lib/algolia'
import { CRAWL_EVENTS_CHANNEL } from '../../lib/crawl-events-channel'
import { shopResultBlobPath } from '../../lib/crawl-run'
import sendSlackMessage from '../../lib/send-slack-message'

interface RunShopApproval {
  slug: string
  initialQuery?: string
  productsToUpload: AlgoliaProduct[]
}

async function publishNewData(config: ReturnType<typeof useRuntimeConfig>, itemCount: number, initialQuery?: string, domain?: string) {
  const kvUrl = config.kvRestApiUrl
  const kvToken = config.kvRestApiToken
  if (!kvUrl || !kvToken)
    return
  const publisher = new Redis({ url: kvUrl, token: kvToken })
  await publisher.publish(CRAWL_EVENTS_CHANNEL, {
    source: 'crawl.newData',
    meta: { itemCount, initialQuery, domain },
  }).catch((err: unknown) => {
    console.error('[approve] redis publish failed', err)
  })
}

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    // Legacy single-file approval — kept for in-flight pre-refactor links.
    fileUrl?: string
    initialQuery?: string
    productsToUpload?: AlgoliaProduct[]
    // Run-based approval — one or more shops from the same crawl run.
    runId?: string
    shops?: RunShopApproval[]
  }>(event)
  const config = useRuntimeConfig()

  if (body.fileUrl) {
    if (!body.productsToUpload?.length)
      throw createError({ statusCode: 400, statusMessage: 'productsToUpload is missing' })

    const response = await upsetAlgoliaObjects(body.productsToUpload, config)
    const itemCount = response[0]?.objectIDs.length || 0
    sendSlackMessage(config.slackWebhookUrl, {
      title: `:checkered_flag: Algolia upload for taskId ${body.fileUrl} with *${itemCount}* items finished`,
    })
    await publishNewData(config, itemCount, body.initialQuery)
    await del(body.fileUrl)
    return { success: true }
  }

  if (!body.runId || !body.shops?.length)
    throw createError({ statusCode: 400, statusMessage: 'runId and shops are required' })

  let totalItems = 0
  for (const shop of body.shops) {
    if (!shop.productsToUpload?.length)
      continue
    const response = await upsetAlgoliaObjects(shop.productsToUpload, config)
    const itemCount = response[0]?.objectIDs.length || 0
    totalItems += itemCount
    await publishNewData(config, itemCount, shop.initialQuery, shop.slug)
    await del(shopResultBlobPath(body.runId, shop.slug, 'ok'))
  }

  await sendSlackMessage(config.slackWebhookUrl, {
    title: `:checkered_flag: Run ${body.runId}: approved ${body.shops.length} shop${body.shops.length === 1 ? '' : 's'}, *${totalItems}* items uploaded to Algolia`,
  })

  return { success: true }
})
