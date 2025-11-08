import type { Locale } from 'vue-i18n'
import type { AlgoliaProduct } from '~~/types/algolia'
import { randomUUID } from 'node:crypto'
import { put } from '@vercel/blob'
import { v4 as uuidv4 } from 'uuid'
import { upsetAlgoliaObjects } from '../../lib/algolia'
import sendSlackMessage from '../../lib/send-slack-message'
import shopConfig, { toTest } from '../../utils/shop-config'

interface CrawledItem {
  objectID: string
  name: string
  sourceUrl: string
  brand: string
  price: string
  description?: string
  imageSrc?: string
  imageSrcset?: string
  imageAlt?: string
  shopDomain: string
  group: string
  color1?: string
  color2?: string
  color3?: string
  colorMore?: string
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = await readBody<{ query: string, locale: Locale, domain: keyof typeof shopConfig }>(event)
  const taskId = uuidv4()

  console.info('Crawl - START with body', body)
  sendSlackMessage(config.slackWebhookUrl, {
    title: ':arrow_forward: *New Crawling started with*',
    jsonString: JSON.stringify({ ...body, config: { taskId, isCrawlUploadAutomaticEnabled: config.isCrawlUploadAutomaticEnabled } }),
  })

  if (!body.query || !body.locale)
    throw new Error('Body must contain query and locale')

  const browser_config_payload = {
    type: 'BrowserConfig',
    params: {
      // https://docs.crawl4ai.com/advanced/undetected-browser/#anti-bot-features-comparison
      // Caution this options remove the webdriver property from navigator but it's need for galaxus.de as example
      // enable_stealth: true,
      // Set headless to false to see the browser window - local machine only
      headless: true,
      viewport_width: 1280,
      viewport_height: 720,
      headers: {
        // Set a standard User-Agent string (low entropy) - neccessary for galaxus.de
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        // Provide the client hints (high entropy values are derived from these) - neccessary for galaxus.de
        'Sec-CH-UA': '"Not_A Brand";v="99", "Google Chrome";v="120", "Chromium";v="120"',
        'Sec-CH-UA-Mobile': '?0',
        'Sec-CH-UA-Platform': '"Windows"',
      },
    },
  }
  const clickLoadMore = `
    document.querySelector('main > div:nth-child(6) > div:nth-child(6) > div:nth-child(2) > section > div:nth-child(1) > div:nth-child(3) > button').click();
    `

  const crawler_config_payload = {
    type: 'CrawlerRunConfig',
    params: {
      /* proxy_config: {
        type: 'ProxyConfig',
        params: {
        // Germany proxy
          server: '194.28.226.156:3128',
        },
      }, */
      js_only: false,
      session_id: randomUUID(),
      exclude_all_images: true,
      exclude_external_links: true,
      exclude_social_media_domains: true,
      exclude_social_media_links: true,
      // Wait 2s before capturing final HTML
      delay_before_return_html: 2.0,
      page_timeout: 60000,
      // Specifically strip <form> elements
      remove_forms: true,
      // Attempt to remove modals/popups
      remove_overlay_elements: true,
      keep_data_attributes: false,
      only_text: true,
      // js_code: clickLoadMore,
      // wait_for: 'js:() => document.readyState === \'complete\'',
      extraction_strategy: {},
      // magic=True tries multiple stealth features.
      // - simulate_user=True mimics mouse movements or random delays.
      // - override_navigator=True fakes some navigator properties (like user agent checks).
      magic: true,
      simulate_user: true,
      override_navigator: true,
      // Tells the crawler to try scrolling the entire page
      scan_full_page: true,
      // Delay (seconds) between scroll steps
      scroll_delay: 1,
      /* extraction_strategy: {
        type: 'LLMExtractionStrategy',
        params: {
          llm_config: {
            type: 'LLMConfig',
            // params: { provider: 'ollama/llama3', api_token: 'none', base_url: 'http://host.docker.internal:11434' },
            params: { provider: 'openai/gpt-4o-mini', api_token: '' },

          },
          schema: {
            name: 'Name of the Product e.g. Schwarze Jacke',
            sourceUrl: 'Detail URL of the product',
            brand: 'The brand of the product e.g. Garmin',
            description: 'Description of the product e.g. 45mm lang, diverse farben',
            price: 'Price of the product e.g. 15€',
            imageSrc: 'Image src of the product',
            shopDomain: 'Add the shop domain e.g. baur.de',
            group: 'satsback',
            colors: 'Color options of the product. E.g. Braun, Schwarz',
          },
          extraction_type: 'schema',
          instruction: 'From the crawled content, extract all products within the css class product-card-grid with name, price, description, imageUrl, color',
        },
      }, */
      /* virtual_scroll_config: {
        type: "VirtualScrollConfig",
        params: {
          container_selector:"#feed",      // CSS selector for scrollable container
          scroll_count:20,                 // Number of scrolls to perform
          scroll_by:"container_height",    // How much to scroll each time
          wait_after_scroll:0.5           // Wait time (seconds) after each scroll
        }
      } */
    },
  }

  // Crawl every url
  interface ParticalCrawlInfo {
    domain: string
    crawledItems?: CrawledItem[]
    info?: string
  }
  const runInfo: {
    totalCrawledItems: number
    totalUploadedToAlgolia: number
    shops: ParticalCrawlInfo[]
  } = {
    totalCrawledItems: 0,
    totalUploadedToAlgolia: 0,
    shops: [],
  }
  let algoliaProducts: AlgoliaProduct[] = []

  let slackBodyRunInfo = ''

  let testOnlyDomains

  // Test only one domain
  if (body.domain && shopConfig[body.domain]) {
    testOnlyDomains = { [body.domain]: shopConfig[body.domain] }
  }

  for (const [key, value] of Object.entries(testOnlyDomains || shopConfig)) {
    const partialCrawlInfo: ParticalCrawlInfo = {
      domain: key,
    }

    crawler_config_payload.params.extraction_strategy = {
      type: 'JsonCssExtractionStrategy',
      params: {
        schema: value.productCssShema,
      },
    }
    const searchURL = value.searchURL(body.query, body.locale)
    const crawl_payload = {
      // TODO change search url for each config
      urls: [searchURL],
      browser_config: browser_config_payload,
      crawler_config: crawler_config_payload,
    }

    const response: {
      results: {
        extracted_content: string
      }[]
    } = await $fetch('http://localhost:11235/crawl', {
      method: 'post',
      body: crawl_payload,
    })
    const items: CrawledItem[] = JSON.parse(response.results[0].extracted_content)

    partialCrawlInfo.crawledItems = items
    if (items.length === 0) {
      partialCrawlInfo.info = `no items found for domain ${key}. Check if the domain is correct. Either the URL ${searchURL} is wrong, the CSS config is old oder there are just no items`
      console.info(partialCrawlInfo.info)
    }

    slackBodyRunInfo += `${partialCrawlInfo.domain}\n`
    if (partialCrawlInfo.info)
      slackBodyRunInfo += `${partialCrawlInfo.info}\n`
    slackBodyRunInfo += '-----------\n'

    const formattedResults: AlgoliaProduct[] = items.map((item) => {
      // Get a copy from item without the colors
      const { color1, color2, color3, colorMore, ...rest } = item
      let colors = item.color1
      if (item.color2)
        colors += `, ${item.color2}`
      if (item.color3)
        colors += `, ${item.color3}`
      if (item.colorMore)
        colors += `, ${item.colorMore}`

      const formattedResult = {
        ...rest,
        objectID: `${key}-${item.name.replace(/[^a-z0-9 ]/gi, '').replaceAll(' ', '-').toLowerCase()}`,
        group: value.group,
        shopDomain: key,
        colors,
        sourceUrl: !item.sourceUrl.includes('http') ? `https://${key}${item.sourceUrl}` : item.sourceUrl,
      }

      for (const [key, value] of Object.entries(formattedResult)) {
        if (key !== 'name')
          slackBodyRunInfo += `- ${key}: ${value}\n`
      }
      slackBodyRunInfo += '\n\n'

      return formattedResult
    })
    slackBodyRunInfo += '\n-----------\n'
    algoliaProducts = [...algoliaProducts, ...formattedResults]
    console.info(`Crawl - finish partial crawl ${items.length} items for domain ${key}`)

    runInfo.shops.push(partialCrawlInfo)
  }
  runInfo.totalCrawledItems = algoliaProducts.length

  console.info(`Crawl - FINISH with ${algoliaProducts.length} items`)

  await sendSlackMessage(config.slackWebhookUrl, {
    title: `:wrench: Crawled *${algoliaProducts.length}* items ready to upload to algolia. Automatic upload is ${config.isCrawlUploadAutomaticEnabled === 'true' ? 'activated' : 'deactivated'}`,
    richTextBody: slackBodyRunInfo,
  })
  if (config.isCrawlUploadAutomaticEnabled === 'true') {
    upsetAlgoliaObjects(algoliaProducts, config).then((response) => {
      runInfo.totalUploadedToAlgolia = algoliaProducts.length

      sendSlackMessage(config.slackWebhookUrl, {
        title: `:checkered_flag: Algolia upload for taskId *${taskId}* with *${response[0]?.objectIDs.length || 0}* items finished. @Marcel @niklas.grieger`,
      })
    })
  }
  else {
    // Create task for approvement
    // await useStorage().setItem(`upload:${taskId}`, algoliaProducts)
    const { url } = await put(`crawl/to-approve/${config.public.algoliaProductIndex}-${taskId}.json`, JSON.stringify(algoliaProducts), { access: 'public', contentType: 'application/json' })
    if (algoliaProducts.length === 0) {
      sendSlackMessage(config.slackWebhookUrl, {
        title: `:checkered_flag: No products found by crawler`,
      })
    }
    else {
      sendSlackMessage(config.slackWebhookUrl, {
        title: `:wrench: Automatice upload to algolia is disable so waiting for appove of *${algoliaProducts.length}* to upload to algolia. @Marcel @niklas.grieger`,
        approveUploadActionUrl: `${config.baseUrl}/internal/approve-crawl?fileUrl=${url}`,
      })
    }
  }

  return { success: true }
})
