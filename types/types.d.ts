export interface CrawlSchemaField {
  name: string
  selector: string
  type: 'text' | 'attribute'
  attribute?: string
  default?: string
}

export interface CrawlSchema {
  type: 'dict'
  value: {
    baseSelector: string
    fields: CrawlSchemaField[]
  }
}

export interface CrawlPaging {
  loadMoreSelector?: string
  pageQueryParam?: string
  customPagingQueryParam?: string
}

export interface StoreCrawlData {
  searchUrl: string | null
  cms: string
  crawlable: boolean
  comment?: string
  schema?: CrawlSchema
  paging?: CrawlPaging
  /**
   * A query string that's known to return at least one product on this shop.
   * Used by `pnpm gen:schema` instead of the generic default ("geschenk")
   * for niche shops where a generic word returns zero results. Doesn't
   * affect production crawls.
   */
  sampleQuery?: string
  /**
   * HTTP status this shop serves when a search has zero hits, for shops that
   * answer "no results" with an error page instead of an empty listing
   * (biggreensmile.de 404s and renders its generic not-found page).
   *
   * The webhook otherwise treats any 4xx/5xx as a failed crawl — see
   * `isHttpFailure` — because a blocked or rate-limited shop is
   * indistinguishable from one with no matches. Setting this opts a single
   * shop out of that rule for one specific status, so a no-hit query is
   * recorded as an empty result instead of a failure. Every other shop keeps
   * alarming, which is what catches a `searchUrl` template going stale.
   *
   * Only set this once you've confirmed the shop returns the status for a
   * genuinely empty search *and* its `baseSelector` extracts 0 items from
   * that page — an error page carrying recommendation tiles would otherwise
   * be indexed as search results.
   */
  emptyResultStatus?: number
}

export interface Store {
  name: string
  text: string
  discountValue?: string
  slug: string
  group: 'satsback' | 'payWithBitcoin'
  image: string
  description: string
  store_id: string
  created_at: string
  updated_at: string
  category: string
  url?: string
  crawl?: StoreCrawlData
}
