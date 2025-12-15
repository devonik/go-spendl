interface CompleteCrawlWebhookPayload {
  task_id: string
  task_type: 'crawl'
  status: 'completed'
  timestamp: string
  urls: string[]
  data: {
    markdown?: string
    extracted_content: Record<string, any>[]
    links?: Record<string, string>[]
  }
}
export default defineEventHandler(async (event) => {
  const body = await readBody<CompleteCrawlWebhookPayload>(event)
  const headers = getRequestHeaders(event)
  console.log('Webhook headers:', headers)
  // TODO check secret header 'X-Webhook-Secret' here
  console.log('Received crawl complete webhook:', body)

  // TODO Process the webhook payload as needed
  return 'Hello Nitro'
})
