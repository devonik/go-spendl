import type { Store, StoreCrawlData } from '~~/types/types'
import overridesJson from '~~/server/data/store-overrides.json'

interface StoreOverride {
  category: string
  url?: string
  crawl?: StoreCrawlData
}

const storeOverrides = overridesJson as Record<string, StoreOverride>

function extendStores(stores: Store[]): Store[] {
  return stores.map((store) => {
    const override = storeOverrides[store.slug]
    return {
      ...store,
      group: store.group ?? 'satsback',
      category: override?.category ?? 'categories.other',
      ...(override?.url ? { url: override.url } : {}),
      ...(override?.crawl ? { crawl: override.crawl } : {}),
    }
  })
}

export const cachedStores = defineCachedFunction(async (country: string) => {
  const data = await $fetch<Store[]>(`https://satsback.com/api/v2/gospendl/stores/${country}`)

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
    category: 'categories.retail',
  })

  return extendStores(data)
}, {
  maxAge: import.meta.dev ? 5 * 1000 : 24 * 60 * 60 * 1000,
  name: 'satsbackStores',
  getKey: (country: string) => country,
})
