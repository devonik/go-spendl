import type { Locale } from 'vue-i18n'
import type { AlgoliaProduct } from '~~/types/algolia'
import { randomUUID } from 'node:crypto'
import { put } from '@vercel/blob'
import { v4 as uuidv4 } from 'uuid'
import { upsetAlgoliaObjects } from '../../lib/algolia'
import sendSlackMessage from '../../lib/send-slack-message'
import shopConfig, { toTest } from '../../utils/shop-config'

interface CrawlerRunConfig {
  type: 'CrawlerRunConfig'
  params: {
    js_only?: boolean
    js_code?: string[]
    // Timeout for page navigation or JS steps. Increase for slow sites. In MS. Default 60000
    page_timeout?: number
    wait_for?: string
    wait_for_images: boolean
    session_id: string
    exclude_all_images: boolean
    exclude_external_links: boolean
    exclude_social_media_domains: boolean
    exclude_social_media_links: boolean
    remove_forms: boolean
    remove_overlay_elements: boolean
    keep_data_attributes: boolean
    extraction_strategy: Record<string, unknown>
    virtual_scroll_config?: Record<string, unknown>
    proxy_config?: Record<string, unknown>
    magic: boolean
    simulate_user: boolean
    override_navigator: boolean
    scan_full_page?: boolean
    scroll_delay?: number
  }
}
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

interface ParticalCrawlInfo {
  domain: string
  crawledItems?: CrawledItem[]
  info?: string
}

function generateJSLoadMoreScript(loadMoreSelector: string): string {
  if (!loadMoreSelector)
    throw new Error('Cannot generateJSLoadMoreScript: loadMoreSelector is required')
  return `
      (async () => {

        await document.querySelector('${loadMoreSelector}').click();
        await new Promise(r => setTimeout(r, 300));
        const scrollStep = 100; // Amount to scroll each time
        const scrollInterval = 100; // Time in milliseconds between each scroll (adjust for speed)
        const scrollingElement = document.documentElement || document.body; // Cross-browser compatibility

        const scrollIntervalId = setInterval(() => {
          // Check if we are at the bottom of the page
          // (scrollTop + clientHeight) should be approximately equal to scrollHeight
          if (
            Math.ceil(scrollingElement.scrollTop + scrollingElement.clientHeight) >=
            scrollingElement.scrollHeight
          ) {
            // If at the bottom, stop the interval
            clearInterval(scrollIntervalId);
            window.finish = true;
            console.log('Finished scrolling');
          } else {
            // Otherwise, scroll down by the defined step
            window.scrollBy(0, scrollStep);
          }
        }, scrollInterval);
    })();
    `
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = await readBody<{ query: string, locale: Locale, domain: keyof typeof shopConfig }>(event)

  if (!body.query || !body.locale)
    throw new Error('Body must contain query and locale')

  const taskId = uuidv4()
  const runConfig = { ...body, config: { taskId, isCrawlUploadAutomaticEnabled: config.isCrawlUploadAutomaticEnabled, crawlUrl: config.crawl4AiUrl } }
  console.info('Crawl - START with body', runConfig)
  sendSlackMessage(config.slackWebhookUrl, {
    title: ':arrow_forward: *New Crawling started with*',
    jsonString: JSON.stringify(runConfig),
  })

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

  const crawler_config_payload: CrawlerRunConfig = {
    type: 'CrawlerRunConfig',
    params: {
      /* proxy_config: {
        type: 'ProxyConfig',
        params: {
        // Germany proxy
          server: '194.28.226.156:3128',
        },
      }, */
      // Mark that we do not re-navigate, but run JS in the same session:
      // js_only: true,
      wait_for_images: true,
      session_id: randomUUID(),
      exclude_all_images: true,
      exclude_external_links: true,
      exclude_social_media_domains: true,
      exclude_social_media_links: true,
      // Specifically strip <form> elements
      remove_forms: true,
      // Attempt to remove modals/popups
      remove_overlay_elements: true,
      keep_data_attributes: false,
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
      scroll_delay: 0.5,
    },
  }

  // Crawl every url
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

  console.info(`Crawl - starting crawl on ${testOnlyDomains ? Object.keys(testOnlyDomains) : Object.keys(shopConfig)} domains`)
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

    const searchURLs = [value.searchURL(body.query, body.locale)]
    // PAGING handling
    // pageQueryParam is set if we can simplay add a query param to get page 2,3,4...
    // loadMoreSelector is set if we need to click a button to load more items
    if (value.paging) {
      if (value.paging.pageQueryParam) {
      // Add paging pages
        const url = new URL(searchURLs[0])
        url.searchParams.set(value.paging.pageQueryParam, '2')
        console.info(`Crawl - added paging param to url: ${url.toString()}`)
        searchURLs.push(url.toString())
      }
      else if (value.paging.loadMoreSelector) {
      // If paging is configured as loadMoreSelector add js code
        if (value.paging && value.paging.loadMoreSelector) {
          // crawler_config_payload.params.page_timeout = 120000
          // Do not scan full page if we add js lazy load (cause it also scrolls after pressing the button)
          crawler_config_payload.params.scan_full_page = false
          crawler_config_payload.params.js_code = [generateJSLoadMoreScript(value.paging.loadMoreSelector)]
          crawler_config_payload.params.wait_for = 'js: () => window.finish === true'
        }
      }
    }

    const crawl_payload = {
      urls: searchURLs,
      browser_config: browser_config_payload,
      crawler_config: crawler_config_payload,
    }

    const response: {
      results: {
        extracted_content: string
      }[]
    } = await $fetch(`${config.crawl4AiUrl}/crawl`, {
      method: 'post',
      body: crawl_payload,
    })

    console.log('response', response)

    const items: CrawledItem[] = response.results.reduce((accumulator, currentObj) => {
      const json = JSON.parse(currentObj.extracted_content)
      return accumulator.concat(json)
    }, [])

    partialCrawlInfo.crawledItems = items
    if (items.length === 0) {
      partialCrawlInfo.info = `no items found for domain ${key}. Check if the domain is correct. Either the URLs ${searchURLs} is wrong, the CSS config is old oder there are just no items`
      console.info(partialCrawlInfo.info)
    }

    slackBodyRunInfo += `${partialCrawlInfo.domain}\n`
    if (partialCrawlInfo.info)
      slackBodyRunInfo += `${partialCrawlInfo.info}\n`
    slackBodyRunInfo += '-----------\n'

    items.filter(item => !item.price).forEach((item) => {
      slackBodyRunInfo += `- Item without price found: ${item.name} - ${item.sourceUrl}. Double check why price not crawled\n\n`
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
        objectID: `${key}-${item.name.replace(/[^a-z0-9 ]/gi, '').replaceAll(' ', '-').toLowerCase()}`,
        group: value.group,
        shopDomain: key,
        colors,
        sourceUrl: !item.sourceUrl.includes('http') ? `https://${key}${item.sourceUrl}` : item.sourceUrl,
      }
    })

    if (formattedResults[0]) {
      for (const [key, value] of Object.entries(formattedResults[0])) {
        if (key !== 'name')
          slackBodyRunInfo += `- ${key}: ${value}\n`
      }
    }
    else {
      slackBodyRunInfo += `- Could not read product data\n`
    }

    slackBodyRunInfo += '\n\n'
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
