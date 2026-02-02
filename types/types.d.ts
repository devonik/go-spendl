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
  category?: string
  categoryConfidence?: number
}
