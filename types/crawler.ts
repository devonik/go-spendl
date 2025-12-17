export interface CrawlJobPayload {
  // See https://github.com/unclecode/crawl4ai/blob/a87e8c1c9e1f60e9418057d3d9d9b6ea1a8174af/deploy/docker/job.py#L46C7-L46C22
  urls: string[]
  crawler_config: CrawlerRunConfig
  browser_config: BrowserConfig
  webhook_config?: CrawlerWebhookPayload
}

export interface BrowserConfig {
  type: 'BrowserConfig'
  params: {
    // Set headless to false to see the browser window - local machine only
    headless: boolean
    viewport_width: number
    viewport_height: number
    headers: Record<string, string>
    /**
     * Stealth mode uses playwright-stealth to modify browser fingerprints and behaviors. Enable it with a simple flag:
     * https://docs.crawl4ai.com/advanced/undetected-browser/#anti-bot-features-comparison
     * Caution this options remove the webdriver property from navigator but it's need for galaxus.de as example
     */
    enable_stealth?: boolean
  }
}
export enum CacheMode {
  /** Normal caching (read/write) */
  ENABLED,
  /** No caching at all */
  DISABLED,
  /** Only read from cache */
  READ_ONLY,
  /** Only write to cache */
  WRITE_ONLY,
  /** Skip cache for this operation */
  BYPASS,
}
export interface CrawlerRunConfig {
  type: 'CrawlerRunConfig'
  params: {
    /** https://docs.crawl4ai.com/core/cache-modes/ */
    cache_mode?: number
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
    /**
     * Attempt to remove modals/popups
     * Careful it may produce bot detection. Running-sport couldnt be crawled cause of it
     */
    remove_overlay_elements?: boolean
    keep_data_attributes: boolean
    extraction_strategy: Record<string, unknown>
    virtual_scroll_config?: Record<string, unknown>
    proxy_config?: Record<string, unknown>
    magic: boolean
    simulate_user: boolean
    override_navigator: boolean
    scan_full_page?: boolean
    scroll_delay?: number
    /**
     * Retains only the part of the page matching this selector. Affects the entire extraction process.
     */
    css_selector?: string
    /**
     * If you don’t need a persistent profile or identity-based approach, Magic Mode offers a quick way to simulate human-like browsing without storing long-term data.
     * - Simulates a user-like experience
     * - Randomizes user agent & navigator
     * - Randomizes interactions & timings
     * - Masks automation signals
     * - Attempts pop-up handling
     */
    magic?: boolean
  }
}

export interface WebhookHeaders {
  'X-Webhook-Secret': string
  'X-Domain'?: string
  'X-Group'?: string
}
export interface CrawlerWebhookPayload {
  // Required. Your HTTP(S) endpoint to receive notifications
  webhook_url: string
  // Default false. Include full result data in webhook payload (default: false)
  webhook_data_in_payload?: boolean
  // Optional. Additional headers to include in the webhook request
  webhook_headers: WebhookHeaders
}

export interface CrawledItem {
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
