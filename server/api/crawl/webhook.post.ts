import type { AlgoliaProduct } from '~~/types/algolia'
import type { CrawledItem } from '~~/types/crawler'
import { put } from '@vercel/blob'
import { upsetAlgoliaObjects } from '~~/server/lib/algolia'
import sendSlackMessage from '~~/server/lib/send-slack-message'

interface CompleteCrawlWebhookPayload {
  task_id: string
  task_type: 'crawl'
  status: 'completed' | 'failed'
  timestamp: string
  urls: string[]
  data?: {
    success: true
    results: any
    server_processing_time_s: number
    server_memory_delta_mb: number
    server_peak_memory_mb: number
  }
  error?: string
}

interface Crawl4AIData {
  extracted_content: string
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

  if (secret !== config.crawlWebhookSecret) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  if (body.status === 'failed') {
    console.error(`Crawl task ${body.task_id} failed with error: ${body.error}`)
    sendSlackMessage(config.slackWebhookUrl, {
      title: `:sob: *${body.task_id}* Crawl failed for domain ${domain}`,
      jsonString: body.error,
    })
    return { success: false, message: `Crawl task failed: ${body.error}` }
  }
  else if (body.status === 'completed') {
    console.log('body.data?.results', body.data?.results)
    console.log('STRINGIFY body.data?.results', JSON.stringify(body.data?.results))
    const items: CrawledItem[] = body.data?.results.reduce((accumulator: Crawl4AIData[], currentObj: Crawl4AIData) => {
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
    slackInfo = `Extracted ${items.length || 0} items.\n`
    items.filter(item => !item.price).forEach((item) => {
      slackInfo += `- Item without price found: ${item.name} - ${item.sourceUrl}. Double check why price not crawled\n\n`
    })

    sendSlackMessage(config.slackWebhookUrl, {
      title: `:wrench: *${body.task_id}* Crawl finish and ${items.length || 0} items are ready to upload`,
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

      return {
        ...rest,
        objectID: `${domain}-${item.name.replace(/[^a-z0-9 ]/gi, '').replaceAll(' ', '-').toLowerCase()}`,
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
      })
    }
    else {
    // Create task for approvement
      const { url } = await put(`crawl/to-approve/${config.public.algoliaProductIndex}-${body.task_id}.json`, JSON.stringify(formattedResults), { access: 'public', contentType: 'application/json' })

      sendSlackMessage(config.slackWebhookUrl, {
        title: `:wrench: *${body.task_id}* Automatic Algolia update is disabled and task is waiting for appove of *${formattedResults.length}* items. @Marcel @niklas.grieger`,
        approveUploadActionUrl: `${config.baseUrl}/internal/approve-crawl?fileUrl=${url}`,
      })
    }
  }

  return { success: true }
})
