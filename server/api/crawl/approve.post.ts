import type { AlgoliaProduct } from '~~/types/algolia'
import { del } from '@vercel/blob'
import { upsetAlgoliaObjects } from '../../lib/algolia'
import sendSlackMessage from '../../lib/send-slack-message'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ fileUrl: string, productsToUpload: AlgoliaProduct[] }>(event)
  const config = useRuntimeConfig()
  if (!body.fileUrl)
    throw new Error('fileUrl is missing')

  const response = await upsetAlgoliaObjects(body.productsToUpload, config)
  sendSlackMessage(config.slackWebhookUrl, {
    title: `:checkered_flag: Algolia upload for taskId ${body.fileUrl} with *${response[0]?.objectIDs.length || 0}* items finished`,
  })
  // Delete file from vercel storage
  await del(body.fileUrl)

  return { success: true }
})
