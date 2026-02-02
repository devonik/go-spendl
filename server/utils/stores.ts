import type { Store } from '~~/types/types'
import { detectCategory } from '../lib/store-category-matcher'

async function extendStores(stores: Store[]) {
  return stores.map((store: any) => {
    const detectCategoryResult = detectCategory(store.description || '')
    if (detectCategoryResult.confidence === 0) {
      console.warn('Map category to store: Could not detect category for store', { slug: store.slug, description: store.description })
    }
    return { ...store, group: store.group ?? 'satsback', category: detectCategoryResult.category, categoryConfidence: detectCategoryResult.confidence,
    }
  })
}
export const cachedStores = defineCachedFunction(async (country: string) => {
  // Get satsback stores
  const data = await $fetch<Store[]>(`https://satsback.com/api/v2/gospendl/stores/${country}`)

  // Add shopinbit
  data.unshift({
    name: 'Shopinbit',
    text: '3% BTC Rabatt',
    discountValue: '3%',
    slug: 'shopinbit',
    group: 'payWithBitcoin',
    image: 'https://shopinbit.com/media/54/27/a8/1684356931/iconapple.png',
    description: 'Shopinbit is an online store that allows you to shop with Bitcoin and other cryptocurrencies. They offer a wide range of products including electronics, fashion, home goods, and more. With Shopinbit, you can enjoy the convenience of shopping online while using your favorite digital currencies.',
    store_id: 'shopinbit',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })

  return extendStores(data)
}, {
  maxAge: import.meta.env.DEV ? 5 * 1000 : 24 * 60 * 60 * 1000, // 5 seconds in dev, 24 hours in prod
  name: 'satsbackStores',
  getKey: (country: string) => country,
})
