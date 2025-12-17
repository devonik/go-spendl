import type { Locale } from 'vue-i18n'
import type { CrawlerRunConfig, CrawlerWebhookPayload } from '~~/types/crawler'
import { randomUUID } from 'node:crypto'
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
  const runConfig = { ...body, config: { isCrawlUploadAutomaticEnabled: config.isCrawlUploadAutomaticEnabled, crawlUrl: config.crawl4AiUrl } }
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
      headless: false,
      viewport_width: 800,
      viewport_height: 600,
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
      extraction_strategy: {
        type: 'LLMExtractionStrategy',
        params: {
          llm_config: {
            type: 'LLMConfig',
            params: { provider: 'ollama/llama3.1', api_token: 'none', base_url: 'http://host.docker.internal:11434' },
            // params: { provider: 'openai/gpt-4o-mini', api_token: '' },

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
          instruction: 'Extract product information from the given URL and respond the data with the given schema',
        },
      },
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
      webhook_config,
    }

    const response: {
      task_id: string
    } = await $fetch(`${config.crawl4AiUrl}/llm/job`, {
      method: 'post',
      body: {
        url: searchURLs[0],
        // q: `'Extract a list of product information. You will find all information in the given url'`,
        q: `
You are a highly skilled data extraction assistant specializing in e-commerce product information. Your task is to extract specific details from the provided text content.

**INSTRUCTIONS:**
1.  Carefully read the entire website https://www.baur.de/s/hose/?p=2.
2.  Extract the information for all the "TARGET FIELDS" listed.
3.  If a piece of information is not available in the text, return 'null' for that field.
4.  Return the extracted data exclusively as a structured JSON object.
5.  Do not include any introductory text, explanations, or conversational filler in your output, only the JSON object.

**TARGET FIELDS:**
*   'productName': The full name of the product.
*   'sourceUrl': 'Detail URL of the product'.
*   'brand': The brand name (e.g., "Nike", "Apple").
*   'description': A brief summary of the product's main features and benefits.
*   'price': The numerical price, including the currency symbol (e.g., "$19.99").
*   'imageSrc': The URL of the primary product image.
*   'currency': The currency code (e.g., "USD", "EUR").
*   'availability': The stock status (e.g., "In Stock", "Out of Stock").
*   'sku': The Stock Keeping Unit or product ID.
*   'shopDomain': "Add the shop domain e.g. baur.de",
*   'group': 'static value "satsback"',
*   'colors': 'Color options of the product. E.g. Braun, Schwarz'

**INPUT TEXT:**
[INSERT THE RAW TEXT CONTENT OR HTML HERE]

**OUTPUT FORMAT EXAMPLE (Few-shot example is optional but helpful):**
{
  "productName": "Example Product Title",
  "sourceUrl": "https://shopinbit.com/de/Apple-iPhone-17-Pro-Max/SW10687.6",
  "brand": "Example Brand",
  "price": "$50.00",
  "imageSrc": "http://example.com/images/main.jpg",
  "currency": "USD",
  "availability": "In Stock",
  "description": "A wonderful product that does amazing things.",
  "sku": "12345-AB",
  "shopDomain": "baur.de",
  "group": "satsback",
  "colors": "Black, Green"
}

**OUTPUT (Only the JSON object):**`,
        provider: 'ollama/llama3.1',
        schema: `{
          "name": "Name of the Product e.g. Schwarze Jacke",
          "sourceUrl": "Detail URL of the product",
          "brand": "The brand of the product e.g. Garmin",
          "description": "Description of the product e.g. 45mm lang, diverse farben",
          "price": "Price of the product e.g. 15€",
          "imageSrc": "Image src of the product",
          "shopDomain": "Add the shop domain e.g. baur.de",
          "group": "satsback",
          "colors": "Color options of the product. E.g. Braun, Schwarz"
        }
        `,
        // schema: '{"title": "string", "author": "string", "date": "string", "points": ["string"]}',
        cache: true,
        webhook_config: {
          webhook_url: 'http://localhost:3000/api/crawl/webhook',
          webhook_data_in_payload: true,
          webhook_headers: {
            'X-Webhook-Secret': 'Start123',
            'X-Domain': key,
            'X-Group': value.group,
          },
        },
      },
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
