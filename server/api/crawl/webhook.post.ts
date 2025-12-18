import type { AlgoliaProduct } from '~~/types/algolia'
import type { CrawledItem } from '~~/types/crawler'
import { put } from '@vercel/blob'
import { upsetAlgoliaObjects } from '~~/server/lib/algolia'
import sendSlackMessage from '~~/server/lib/send-slack-message'
import { peers } from '~~/server/routes/ws'

interface CompleteCrawlWebhookPayload {
  task_id: string
  task_type: 'crawl'
  status: 'completed' | 'failed'
  timestamp: string
  urls: string[]
  data?: {
    success: true
    results: Crawl4AIData[]
    server_processing_time_s: number
    server_memory_delta_mb: number
    server_peak_memory_mb: number
  }
  error?: string
}

interface Crawl4AIData {
  url: string
  html: string
  fit_html: string
  success: boolean
  cleaned_html: unknown
  media: Record<string, unknown>
  links: Record<string, unknown>
  downloaded_files: unknown
  js_execution_result: unknown
  screenshot: unknown
  pdf: unknown
  mhtml: unknown
  extracted_content: string | null
  metadata: Record<string, unknown> | null
  error_message: string | null
  session_id: unknown
  response_headers: unknown
  status_code: unknown
  ssl_certificate: unknown
  dispatch_result: unknown
  redirected_url: unknown
  network_requests: unknown
  console_messages: unknown
  tables: unknown[]
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  const body = await readBody<CompleteCrawlWebhookPayload>(event)
  const headers = getRequestHeaders(event)

  console.log('Webhook headers:', headers)
  // TODO check secret header 'X-Webhook-Secret' here

  const group = headers['X-Group'.toLowerCase()]
  const domain = headers['X-Domain'.toLowerCase()]
  const secret = headers['X-Webhook-Secret'.toLowerCase()]
  const initialQuery = headers['X-Initial-Query'.toLowerCase()]
  if (!group) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Header X-Group is missing',
    })
  }
  if (!domain) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Header X-Domain is missing',
    })
  }
  if (!secret) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Header X-Webhook-Secret is missing',
    })
  }
  if (!initialQuery) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Header X-Initial-Query is missing',
    })
  }

  if (secret !== config.crawlWebhookSecret) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }
  console.log('webhook body', body.data?.results)

  if (body.status === 'failed') {
    console.error(`Crawl task ${body.task_id} failed with error`, body.error)
    sendSlackMessage(config.slackWebhookUrl, {
      title: `:sob: *${body.task_id}* Crawl failed for domain ${domain}`,
      jsonString: body.error,
    })
    return { success: false, message: `Crawl task failed: ${body.error}` }
  }
  else if (body.status === 'completed') {
    if (!body.data?.results[0].success) {
      sendSlackMessage(config.slackWebhookUrl, {
        title: `:sob: *${body.task_id}* Crawl failed for domain ${domain}`,
        jsonString: 'Check crawler errors in railway or logs in vercel',
      })
      console.error(`Crawl task ${body.task_id} failed with error`, body.data?.results[0].error_message)
      throw createError({
        statusCode: 500,
        statusMessage: 'Check crawler errors in railway',
      })
    }
    const items: CrawledItem[] = body.data?.results.reduce((accumulator, currentObj) => {
      if (!currentObj.extracted_content)
        return []
      const json = JSON.parse(currentObj.extracted_content)
      return accumulator.concat(json)
    }, [])

    let slackInfo = ''

    if (items.length === 0) {
      sendSlackMessage(config.slackWebhookUrl, {
        title: `:checkered_flag: *${body.task_id}* No products found by crawler`,
        jsonString: `no items found. Check if the domain is correct. Either the URLs ${body.urls.join(', ')} is wrong, the CSS config is old oder there are just no items`,
      })
      return { success: true }
    }
    slackInfo = `Extracted ${items.length || 0} items. Search URLs ${body.urls.join(', ')}\n`
    items.filter(item => !item.price).forEach((item) => {
      slackInfo += `- Item without price found: ${item.name} - ${item.sourceUrl}. Double check why price not crawled\n\n`
    })

    sendSlackMessage(config.slackWebhookUrl, {
      title: `:wrench: *${body.task_id}* Crawl finish and ${items.length || 0} items were found`,
      jsonString: slackInfo,
    })

    const formattedResults: AlgoliaProduct[] = items.filter(item => item.price).map((item) => {
      // Get a copy from item without the colors
      const { color1, color2, color3, colorMore, ...rest } = item
      let colors = item.color1
      if (item.color2)
        colors += `, ${item.color2}`
      if (item.color3)
        colors += `, ${item.color3}`
      if (item.colorMore)
        colors += `, ${item.colorMore}`

      const itemNameSterilized = item.name.replace(/[^a-z0-9 ]/gi, '').replaceAll(' ', '-').toLowerCase()
      const descriptionSterilized = item.description?.replace(/[^a-z0-9 ]/gi, '').replaceAll(' ', '-').toLowerCase()
      return {
        ...rest,
        objectID: `${domain}-${descriptionSterilized ? `${itemNameSterilized}-${descriptionSterilized}` : itemNameSterilized}`,
        group,
        shopDomain: domain,
        colors,
        sourceUrl: !item.sourceUrl.includes('http') ? `https://${domain}${item.sourceUrl}` : item.sourceUrl,
      }
    })

    if (config.isCrawlUploadAutomaticEnabled === 'true') {
      upsetAlgoliaObjects(formattedResults, config).then((response) => {
        sendSlackMessage(config.slackWebhookUrl, {
          title: `:checkered_flag: *${body.task_id}* Algolia upload with *${response[0]?.objectIDs.length || 0}* items finished. @Marcel @niklas.grieger`,
        })
        peers.forEach(peer => peer.send(`{"source": "crawl.newData", "meta": { "itemCount": ${response[0]?.objectIDs.length || 0}, "initialQuery": "${formattedResults[0].name.substring(0, 5)}" } }`))
      })
    }
    else {
    // Create task for approvement
      if (formattedResults.length === 0)
        return
      const { url } = await put(`crawl/to-approve/${config.public.algoliaProductIndex}-${body.task_id}.json`, JSON.stringify({ initialQuery, items: formattedResults }), { access: 'public', contentType: 'application/json' })

      sendSlackMessage(config.slackWebhookUrl, {
        title: `:wrench: *${body.task_id}* Automatic Algolia update is disabled and task is waiting for appove of *${formattedResults.length}* items. @Marcel @niklas.grieger`,
        approveUploadActionUrl: `${config.baseUrl}/internal/approve-crawl?fileUrl=${url}`,
      })
    }
  }

  return { success: true }
})
