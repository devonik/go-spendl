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
    headless: boolean
    viewport_width: number
    viewport_height: number
    headers: Record<string, string>
  }
}
export interface CrawlerRunConfig {
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
