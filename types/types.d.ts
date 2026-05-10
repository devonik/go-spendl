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
