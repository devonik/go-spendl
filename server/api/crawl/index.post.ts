import type { Locale } from 'vue-i18n'
import type { BrowserConfig, CrawlerRunConfig, CrawlerWebhookPayload, CrawlJobPayload } from '~~/types/crawler'
import { randomUUID } from 'node:crypto'
import { v4 as uuidv4 } from 'uuid'
import sendSlackMessage from '../../lib/send-slack-message'
import shopConfig from '../../utils/shop-config'

interface ParticalCrawlInfo {
  domain: string
  task_id?: string
}

function generateJSLoadMoreScript(loadMoreSelector: string): string {
  if (!loadMoreSelector)
    throw new Error('Cannot generateJSLoadMoreScript: loadMoreSelector is required')
  return `
      (async () => {
        // Remove dialog by button click. Introduced since scroll is blocked in galaxus.de otherwise

        await document.querySelector('${loadMoreSelector}').click();

        // TODO Scroll method. Not needed anymore since crawl4ai 0.7.8 but maybe in the feature ? Was needed for lazy loading
        /* await new Promise(r => setTimeout(r, 300));
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
        }, scrollInterval); */
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

  const browser_config_payload: BrowserConfig = {
    type: 'BrowserConfig',
    params: {
      headless: true,
      viewport_width: 1900,
      viewport_height: 1200,
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
      keep_data_attributes: false,
      extraction_strategy: {},
      simulate_user: true,
      override_navigator: true,
      // Tells the crawler to try scrolling the entire page
      scan_full_page: true,
      // Delay (seconds) between scroll steps
      scroll_delay: 0.5,
    },
  }

  const webhook_config: CrawlerWebhookPayload = {
    webhook_url: `${config.baseUrl}/api/crawl/webhook`,
    webhook_data_in_payload: true,
    webhook_headers: {
      'X-Webhook-Secret': config.crawlWebhookSecret,
    },
  }

  // Crawl every url
  const runInfo: {
    shops: ParticalCrawlInfo[]
  } = {
    shops: [],
  }

  let testOnlyDomains

  // Test only one domain
  if (body.domain && shopConfig[body.domain]) {
    testOnlyDomains = { [body.domain]: shopConfig[body.domain] }
  }

  console.info(`Crawl - starting crawl on ${testOnlyDomains ? Object.keys(testOnlyDomains) : Object.keys(shopConfig)} domains`)
  const domains = Object.entries(testOnlyDomains || shopConfig)
  for (const [key, value] of domains) {
    webhook_config.webhook_headers['X-Domain'] = key
    webhook_config.webhook_headers['X-Group'] = value.group

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
          // Do not scan full page if we add js lazy load (cause it also scrolls after pressing the button)
          // crawler_config_payload.params.scan_full_page = false
          crawler_config_payload.params.js_code = [generateJSLoadMoreScript(value.paging.loadMoreSelector)]
          crawler_config_payload.params.wait_for = 'js: () => window.finish === true'
        }
      }
    }

    const crawl_payload: CrawlJobPayload = {
      urls: searchURLs,
      browser_config: browser_config_payload,
      crawler_config: crawler_config_payload,
      webhook_config,
    }

    const response: {
      task_id: string
    } = await $fetch(`${config.crawl4AiUrl}/crawl/job`, {
      method: 'post',
      body: crawl_payload,
    })

    partialCrawlInfo.task_id = response.task_id
    console.info(`Crawl - Job with taskId ${partialCrawlInfo.task_id} started for domain ${partialCrawlInfo.domain}`)

    runInfo.shops.push(partialCrawlInfo)
  }

  await sendSlackMessage(config.slackWebhookUrl, {
    title: `:wrench: Crawl Jobs started for *${runInfo.shops.length}* domains. Automatic upload is ${config.isCrawlUploadAutomaticEnabled === 'true' ? 'activated' : 'deactivated'}`,
    richTextBody: runInfo.shops.map(shop => `- *${shop.task_id}* - ${shop.domain}`).join('\n'),
  })

  return { success: true }
})
