import { del } from '@vercel/blob'

import sendSlackMessage from '../../lib/send-slack-message'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ fileUrl: string }>(event)
  const config = useRuntimeConfig()

  if (!body.fileUrl)
    throw new Error('fileUrl is missing')

  await del(body.fileUrl)

  sendSlackMessage(config.slackWebhookUrl, {
    title: `:x: Crawl task declined. Data has been deleted. Old URL ${body.fileUrl}`,
  })

  return { success: true }
})
