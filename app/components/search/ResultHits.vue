<script lang="ts" setup>
import type { AlgoliaProduct } from '~~/types/algolia'
import { useDebounceFn } from '@vueuse/core'
import { AisInfiniteHits } from 'vue-instantsearch/vue3/es'

const localePath = useLocalePath()
const { data: stores } = useStores()
const { locale, t } = useI18n()
const toast = useToast()

const page = defineModel('page', {
  type: Number,
  required: false,
  default: 1,
})
const query = defineModel('query', {
  type: String,
  required: true,
})
const serverMessages = ref<{
  text: string
  actionLink?: string
}[]>([])

const emptyResultsCatchedOnce = ref(false)
const crawlFailed = ref(false)

const matchingStores = computed(() => {
  const q = query.value?.trim().toLowerCase()
  if (!q || !stores.value)
    return []
  return stores.value.filter((store) => {
    const name = store.name?.toLowerCase() ?? ''
    const description = store.description?.toLowerCase() ?? ''
    const categoryLabel = store.category ? t(store.category).toLowerCase() : ''
    return name.includes(q) || description.includes(q) || categoryLabel.includes(q)
  })
})

const handleItemsDataChangeDebounce = useDebounceFn((items: AlgoliaProduct[]) => {
  serverMessages.value = []
  if (items.length === 0 && !emptyResultsCatchedOnce.value) {
    toast.add({
      title: 'Searching for more data',
      description: `We have no data for your search. We'll search for it in the background.`,
      color: 'primary',
      icon: 'i-lucide-search',
    })
    crawlFailed.value = false
    const inferredCategories = inferCategoriesFromQuery(query.value)
    $fetch('/api/crawl', {
      method: 'POST',
      body: {
        query: encodeURIComponent(query.value),
        locale: locale.value,
        // Narrow the fan-out by inferred categories — falling through to
        // an unfiltered crawl when the query has no obvious match.
        ...(inferredCategories.length > 0 ? { categories: inferredCategories } : {}),
      },
    }).catch(() => {
      crawlFailed.value = true
    })
    emptyResultsCatchedOnce.value = true
  }
}, 1000)

// Best-effort keyword → category mapping. The category i18n keys come from
// `i18n/locales/categories.*.json` and are also what `store.category` holds.
// Coverage is intentionally non-exhaustive: an unmatched query falls through
// to an unfiltered crawl (current behaviour). Add entries as needed.
const KEYWORD_TO_CATEGORIES: { keywords: string[], categories: string[] }[] = [
  {
    categories: ['categories.electronics'],
    keywords: ['fernseher', 'tv', 'television', 'monitor', 'smartphone', 'handy', 'tablet', 'laptop', 'computer', 'kamera', 'camera', 'kopfhörer', 'kopfhoerer', 'headphones', 'console', 'konsole', 'playstation', 'xbox', 'nintendo', 'drucker', 'printer', 'router'],
  },
  {
    categories: ['categories.fashion', 'categories.shoes'],
    keywords: ['shirt', 'pullover', 'hose', 'jeans', 'kleid', 'dress', 'jacke', 'jacket', 'mantel', 'rock', 'skirt', 'schuhe', 'sneaker', 'shoes', 'stiefel', 'boots', 'cap', 'mütze', 'muetze'],
  },
  {
    categories: ['categories.food'],
    keywords: ['kaffee', 'coffee', 'tee', 'tea', 'wein', 'wine', 'bier', 'beer', 'schokolade', 'chocolate', 'kekse', 'pasta', 'olivenöl', 'olivenoel'],
  },
  {
    categories: ['categories.beauty', 'categories.cosmetics'],
    keywords: ['parfum', 'perfume', 'creme', 'cream', 'shampoo', 'lippenstift', 'lipstick', 'mascara', 'foundation'],
  },
  {
    categories: ['categories.fitness'],
    keywords: ['hantel', 'dumbbell', 'yoga', 'fitness', 'racket', 'schläger', 'schlaeger', 'tennis', 'padel', 'crossfit', 'training', 'sportbekleidung'],
  },
  {
    categories: ['categories.furniture'],
    keywords: ['sofa', 'couch', 'bett', 'bed', 'tisch', 'table', 'stuhl', 'chair', 'schrank', 'regal', 'shelf', 'matratze', 'mattress'],
  },
  {
    categories: ['categories.household'],
    keywords: ['toaster', 'küche', 'kueche', 'kitchen', 'staubsauger', 'vacuum', 'mixer', 'kaffeemaschine'],
  },
  {
    categories: ['categories.supplements'],
    keywords: ['vitamin', 'supplement', 'protein', 'creatin', 'creatine'],
  },
  {
    categories: ['categories.energy'],
    keywords: ['strom', 'gas', 'electricity', 'energy', 'tarif'],
  },
]

function inferCategoriesFromQuery(q: string): string[] {
  const lower = q?.trim().toLowerCase()
  if (!lower)
    return []
  const matched = new Set<string>()
  for (const entry of KEYWORD_TO_CATEGORIES) {
    if (entry.keywords.some(k => lower.includes(k))) {
      for (const c of entry.categories)
        matched.add(c)
    }
  }
  return [...matched]
}

interface CrawlEventMessage {
  source: string
  meta: {
    itemCount: number | string
    initialQuery: string
    domain?: string
  }
}

const { data: eventData, error: eventError, open: openEvents } = useEventSource('/api/events', [], {
  immediate: false,
})
// The webhook publishes the shop slug (`baur`), but users want to see the
// domain (`baur.de`). We already have the store list from useStores();
// prefer the curated `url` field, fall back to the hostname of
// `crawl.searchUrl` (present on every crawlable shop, so this covers the
// long tail where nobody wrote a url override), and finally to the slug.
function slugToDomain(slug: string): string {
  const store = stores.value?.find(s => s.slug === slug)
  if (!store)
    return slug
  const raw = store.url || store.crawl?.searchUrl
  if (!raw)
    return slug
  try {
    return new URL(raw).hostname.replace(/^www\./, '')
  }
  catch {
    return slug
  }
}

watch(eventData, (raw) => {
  if (!raw)
    return
  try {
    const json = JSON.parse(raw) as CrawlEventMessage
    if (json.source === 'crawl.newData') {
      const shopLabel = json.meta.domain ? slugToDomain(json.meta.domain) : null
      const q = json.meta.initialQuery
      serverMessages.value?.push({
        text: `${json.meta.itemCount} new items available${shopLabel ? ` from “${shopLabel}”` : ''}. You can search now for “${q}”`,
        actionLink: `/search?q=${q}`,
      })
    }
  }
  catch (error) {
    console.error('Could not parse SSE message', error, raw)
  }
})
watch(eventError, (err) => {
  if (err)
    console.warn('[events] SSE connection error', err)
})
onMounted(() => {
  openEvents()
})

function onSearchAgain(actionLink?: string) {
  if (actionLink)
    navigateTo(localePath(actionLink))
  serverMessages.value = []
  emptyResultsCatchedOnce.value = false
}

function bannerActions(actionLink?: string) {
  return [{
    label: 'Search',
    color: 'info' as const,
    variant: 'subtle' as const,
    class: 'cursor-pointer',
    leadingIcon: 'i-lucide-search',
    onClick: () => onSearchAgain(actionLink),
  }]
}
</script>

<template>
  <AisInfiniteHits>
    <template
      #default="{
        items,
        refinePrevious,
        refineNext,
        isLastPage,
        sendEvent,
      } : {items: AlgoliaProduct[], refinePrevious: () => void, refineNext: () => void, isLastPage: boolean, sendEvent: (eventType: 'click' | 'conversion', hit: any, eventName: string) => void}"
    >
      <!-- If the page is loaded and page is after page 1 then this is to load the page before. But there is a bug when i paginate on client and clikc on it there is a bad request
    <div v-if="page > 1" class="justify-self-center mb-3">
        <UButton
          color="primary"
          :label="isLastPage ? $t('search.noMoreResults') : $t('search.showMoreResults')"
          @click=" () => {
            page--
            refinePrevious()
          }"
        />
      </div> -->

      <div v-if="items.length > 0">
        <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          <SearchProductCard
            v-for="product in items"
            :key="product.objectID"
            :product="product"
            @click-order="sendEvent('conversion', product, 'User clicked on order button')"
          />
        </div>
        <div v-if="matchingStores.length > 0" class="mt-8 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          <SearchStoreCard
            v-for="(shop, index) in matchingStores"
            :key="index"
            :store="shop"
          />
        </div>
      </div>
      <div v-else>
        <div v-if="crawlFailed" class="mb-3 flex items-center gap-3">
          <strong>Crawler is not available, please go directly to the shop</strong>
        </div>
        <div v-else-if="serverMessages.length === 0" class="mb-3 flex items-center gap-3">
          <div class="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          We'll search for it in the background... <strong>In the meanwhile you can go directly visit one of the shop's</strong>
        </div>
        <UBanner
          v-for="message in serverMessages"
          :key="message.text"
          :title="message.text"
          icon="i-lucide-info"
          :actions="bannerActions(message.actionLink)"
          class="mb-3"
        />

        <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          <SearchStoreCard
            v-for="(shop, index) in (matchingStores.length > 0 ? matchingStores : stores)"
            :key="index"
            :store="shop"
          />
        </div>
      </div>

      <div class="justify-self-center mt-3">
        <UButton
          :label="isLastPage ? $t('search.noMoreResults') : $t('search.showMoreResults')"
          :disabled="isLastPage"
          @click=" () => {
            page++
            refineNext()
          }"
        />
      </div>
      <WatchValue :value="items" immediate @change="handleItemsDataChangeDebounce" />
    </template>
  </AisInfiniteHits>
</template>

<style scoped>

</style>
