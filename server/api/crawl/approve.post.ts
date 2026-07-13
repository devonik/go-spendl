import type { AlgoliaProduct } from '~~/types/algolia'
import { Redis } from '@upstash/redis'
import { del } from '@vercel/blob'
import { upsetAlgoliaObjects } from '../../lib/algolia'
import { CRAWL_EVENTS_CHANNEL } from '../../lib/crawl-events-channel'
import sendSlackMessage from '../../lib/send-slack-message'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ fileUrl: string, initialQuery: string, productsToUpload: AlgoliaProduct[] }>(event)
  const config = useRuntimeConfig()
  if (!body.fileUrl)
    throw new Error('fileUrl is missing')

  const response = await upsetAlgoliaObjects(body.productsToUpload, config)
  const itemCount = response[0]?.objectIDs.length || 0
  sendSlackMessage(config.slackWebhookUrl, {
    title: `:checkered_flag: Algolia upload for taskId ${body.fileUrl} with *${itemCount}* items finished`,
  })

  const kvUrl = config.kvRestApiUrl
  const kvToken = config.kvRestApiToken
  if (kvUrl && kvToken) {
    const publisher = new Redis({ url: kvUrl, token: kvToken })
    await publisher.publish(CRAWL_EVENTS_CHANNEL, {
      source: 'crawl.newData',
      meta: { itemCount, initialQuery: body.initialQuery },
    }).catch((err: unknown) => {
      console.error('[approve] redis publish failed', err)
    })
  }

  // Delete file from vercel storage
  await del(body.fileUrl)

  return { success: true }
})
