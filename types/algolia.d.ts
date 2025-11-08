export interface AlgoliaProduct extends Record<string, unknown> {
  name: string
  sourceUrl: string
  brand: string
  description?: string
  price: string
  imageSrc?: string
  imageSrcset?: string
  shopDomain: string
  group: string
  colors?: string
  objectID?: string
  _highlightResult?: HighlightResult
}

export interface HighlightResult {
  name: Name
  shopDomain: ShopDomain
  group: Group
  colors: Colors
}

export interface Name {
  value: string
  matchLevel: string
  fullyHighlighted: boolean
  matchedWords: string[]
}

export interface ShopDomain {
  value: string
  matchLevel: string
  matchedWords: string[]
}

export interface Group {
  value: string
  matchLevel: string
  matchedWords: string[]
}

export interface Colors {
  value: string
  matchLevel: string
  matchedWords: string[]
}
