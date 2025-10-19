export interface AlgoliaProduct {
  name: string
  sourceUrl: string
  brand: string
  description: string
  price: number
  imageUrl: string
  shopDomain: string
  group: string
  colors: string
  objectID: string
  _highlightResult: HighlightResult
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
