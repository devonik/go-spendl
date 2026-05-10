import type { Locale } from 'vue-i18n'
import type { BrowserConfig, CrawlerRunConfig, CrawlerWebhookPayload, CrawlJobPayload } from '~~/types/crawler'
import { randomUUID } from 'node:crypto'
import { v4 as uuidv4 } from 'uuid'
import sendSlackMessage from '../../lib/send-slack-message'
import { cachedStores } from '../../utils/stores'

// Placeholder string used in `crawl.searchUrl` templates (see store-overrides.json).
// Substituted with the user's URL-encoded query at request time.
const SEARCH_URL_PLACEHOLDER = 'ipad'

interface ParticalCrawlInfo {
  domain: string
  task_id?: string
}

export const CacheMode = Object.freeze({
  /** Normal caching (read/write) */
  ENABLED: 1,
  /** No caching at all */
  DISABLED: 2,
  /** Only read from cache */
  READ_ONLY: 3,
  /** Only write to cache */
  WRITE_ONLY: 4,
  /** Skip cache for this operation */
  BYPASS: 5,
})

function generateJSLoadMoreScript(loadMoreSelector: string): string {
  if (!loadMoreSelector)
    throw new Error('Cannot generateJSLoadMoreScript: loadMoreSelector is required')
  return `
      (async () => {
        // Remove dialog by button click. Introduced since scroll is blocked in galaxus.de otherwi
        //await document.querySelector('dialog button:nth-child(2)').click();
        function scrollByWithCallback(x, y, callback) {
          // Check if the browser supports the 'scrollend' event
          if ('onscrollend' in window) {
            const handleScrollEnd = () => {
              window.removeEventListener('scrollend', handleScrollEnd);
              callback();
            };

            window.addEventListener('scrollend', handleScrollEnd);
            // Perform the scroll
            window.scrollBy({
              left: x,
              top: y,
              behavior: 'smooth' // 'smooth' is optional but recommended for user experience
            });
          } else {
            // Use the reliable timeout fallback for older browsers
            console.warn('scrollend event not supported, using setTimeout fallback.');
            scrollToFallback(x, y, callback);
          }
        }

        await new Promise(r => setTimeout(r, 1000));
        // Example Usage:
        scrollByWithCallback(0, document.querySelector('#pageContent section').scrollHeight, async () => {
          console.log('Scrolling of 500px down has finished!');
          await new Promise(r => setTimeout(r, 1000));
          await document.querySelector('${loadMoreSelector}').click();
          window.finish = true
        });

        // TODO Scroll method. Not needed anymore since crawl4ai 0.7.8 but maybe in the feature ? Was needed for lazy loading
        /*await new Promise(r => setTimeout(r, 300));
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
        }, scrollInterval);*/
    })();
    `
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = await readBody<{
    query: string
    locale: Locale
    slug?: string
    /**
     * Restrict the crawl fan-out to stores whose `category` matches one of
     * these i18n keys (e.g. ['categories.electronics']). When omitted we
     * fall back to crawling every store with a schema, which is fine for a
     * handful but doesn't scale once hundreds of shops are wired up.
     */
    categories?: string[]
  }>(event)

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
      cache_mode: CacheMode.BYPASS,
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
      page_timeout: 60000, // 60s limit
      delay_before_return_html: 2.5,
    },
  }

  const webhook_config: CrawlerWebhookPayload = {
    webhook_url: `${config.baseUrl}/api/crawl/webhook`,
    webhook_data_in_payload: true,
    webhook_headers: {
      'X-Webhook-Secret': config.crawlWebhookSecret,
      'X-Initial-Query': body.query,
    },
  }

  // Crawl every url
  const runInfo: {
    shops: ParticalCrawlInfo[]
  } = {
    shops: [],
  }

  // Pull stores from the Satsback list merged with `store-overrides.json`.
  // A store is crawlable iff it has crawl.crawlable + crawl.searchUrl + crawl.schema.
  // Country is the Satsback API's value (e.g. "germany"), distinct from the
  // i18n locale ("de"/"en") on the body.
  const allStores = await cachedStores('germany')
  const crawlableStores = allStores.filter(s => s.crawl?.crawlable && s.crawl.searchUrl && s.crawl.schema)
  const targetStores = body.slug
    ? crawlableStores.filter(s => s.slug === body.slug)
    : body.categories?.length
      ? crawlableStores.filter(s => body.categories!.includes(s.category))
      : crawlableStores

  if (targetStores.length === 0) {
    throw new Error(body.slug
      ? `No crawlable store found for slug "${body.slug}" — needs crawl.crawlable + crawl.searchUrl + crawl.schema in overrides.`
      : body.categories?.length
        ? `No crawlable stores match categories ${JSON.stringify(body.categories)}.`
        : 'No crawlable stores configured (need crawl.crawlable + crawl.searchUrl + crawl.schema in overrides).')
  }

  const filterNote = body.slug
    ? `slug=${body.slug}`
    : body.categories?.length
      ? `categories=${body.categories.join(',')}`
      : 'no filter'
  console.info(`Crawl - starting crawl on ${targetStores.length}/${crawlableStores.length} stores [${filterNote}]: ${targetStores.map(s => s.slug).join(', ')}`)

  for (const store of targetStores) {
    const slug = store.slug
    webhook_config.webhook_headers['X-Domain'] = slug
    webhook_config.webhook_headers['X-Group'] = store.group
    webhook_config.webhook_headers['X-Category'] = store.category

    const partialCrawlInfo: ParticalCrawlInfo = { domain: slug }

    crawler_config_payload.params.extraction_strategy = {
      type: 'JsonCssExtractionStrategy',
      params: {
        schema: store.crawl!.schema,
        verbose: true,
      },
    }

    // Substitute the literal "ipad" placeholder with the user's URL-encoded query.
    const baseUrl = store.crawl!.searchUrl.replaceAll(SEARCH_URL_PLACEHOLDER, encodeURIComponent(body.query))
    const searchURLs = [baseUrl]

    const paging = store.crawl?.paging
    if (paging) {
      if (paging.pageQueryParam) {
        const url = new URL(baseUrl)
        url.searchParams.set(paging.pageQueryParam, '2')
        console.info(`Crawl - added paging param to url: ${url.toString()}`)
        searchURLs.push(url.toString())
      }
      else if (paging.loadMoreSelector) {
        // Click-to-load: drive the page via injected JS and wait for window.finish.
        crawler_config_payload.params.js_code = [generateJSLoadMoreScript(paging.loadMoreSelector)]
        crawler_config_payload.params.wait_for = 'js: () => window.finish === true'
        crawler_config_payload.params.js_only = false
      }
    }

    const crawl_payload: CrawlJobPayload = {
      urls: searchURLs,
      browser_config: browser_config_payload,
      crawler_config: crawler_config_payload,
      webhook_config,
    }

    const response: { task_id: string } = await $fetch(`${config.crawl4AiUrl}/crawl/job`, {
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
