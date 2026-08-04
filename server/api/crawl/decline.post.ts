import { del } from '@vercel/blob'
import { purgeRunFolderIfDone, shopResultBlobPath } from '../../lib/crawl-run'
import sendSlackMessage from '../../lib/send-slack-message'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    // Legacy single-file decline — kept for in-flight pre-refactor links.
    fileUrl?: string
    // Run-based decline — one or more shops from the same crawl run.
    runId?: string
    slugs?: string[]
  }>(event)
  const config = useRuntimeConfig()

  if (body.fileUrl) {
    await del(body.fileUrl)
    sendSlackMessage(config.slackWebhookUrl, {
      title: `:x: Crawl task declined. Data has been deleted. Old URL ${body.fileUrl}`,
    })
    return { success: true }
  }

  if (!body.runId || !body.slugs?.length)
    throw createError({ statusCode: 400, statusMessage: 'runId and slugs are required' })

  await del(body.slugs.map(slug => shopResultBlobPath(body.runId!, slug, 'ok')))

  await sendSlackMessage(config.slackWebhookUrl, {
    title: `:x: Run ${body.runId}: declined ${body.slugs.length} shop${body.slugs.length === 1 ? '' : 's'} (${body.slugs.join(', ')}). Data has been deleted.`,
  })

  // Same as approve: if nothing else in this run still has items to decide,
  // reclaim the folder now (lock kept as straggler marker).
  await purgeRunFolderIfDone(body.runId)

  return { success: true }
})
