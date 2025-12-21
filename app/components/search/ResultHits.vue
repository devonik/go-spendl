<script lang="ts" setup>
import type { AlgoliaProduct } from '~~/types/algolia'
import { useDebounceFn } from '@vueuse/core'
import { AisInfiniteHits } from 'vue-instantsearch/vue3/es'
import shopDomain from '~/assets/shop-domain'

const localePath = useLocalePath()
const { locale } = useI18n()
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

const handleItemsDataChangeDebounce = useDebounceFn((items: AlgoliaProduct[]) => {
  serverMessages.value = []
  if (items.length === 0 && !emptyResultsCatchedOnce.value) {
    toast.add({
      title: 'Searching for more data',
      description: `We have no data for your search. We'll search for it in the background.`,
      color: 'primary',
      icon: 'i-lucide-search',
    })
    $fetch('/api/crawl', {
      method: 'POST',
      body: {
        query: encodeURIComponent(query.value),
        locale: locale.value,
        // Test single domain or 'all' default
        domain: 'baur.de',
      },
    })
    emptyResultsCatchedOnce.value = true
  }
}, 1000)

interface WebsocketJsonMessage {
  source: string
  meta: Record<string, string>
}
const { open } = useWebSocket('/ws', {
  immediate: false,
  async onMessage(ws, event) {
    try {
      const json: WebsocketJsonMessage = JSON.parse(event.data)
      if (json.source === 'crawl.newData') {
        serverMessages.value?.push({
          text: `${json.meta.itemCount} new items available. You can search now for ${json.meta.initialQuery}`,
          actionLink: `/search?q=${json.meta.initialQuery}`,
        })
      }
      else {
        serverMessages.value?.push({
          text: typeof event.data === 'string' ? event.data : await event.data.text(),
        })
      }
    }
    catch (error) {
      console.error('Could not parse json from websocket image', error, event)
    }
  },
})
onMounted(() => {
  open()
})
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

      <div v-if="items.length > 0" class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        <SearchProductCard
          v-for="product in items"
          :key="product.objectID"
          :product="product"
          @click-order="sendEvent('conversion', product, 'User clicked on order button')"
        />
      </div>
      <div v-else>
        <div v-if="serverMessages.length === 0" class="mb-3 flex items-center gap-3">
          <div class="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          We'll search for it in the background... <strong>In the meanwhile you can go directly visit one of the shop's</strong>
        </div>
        <UBanner
          v-for="message in serverMessages" :key="message.text" :title="message.text" icon="i-lucide-info" :actions="[{
            label: 'Search',
            color: 'info',
            variant: 'subtle',
            class: 'cursor-pointer',
            leadingIcon: 'i-lucide-search',
            onClick: () => { message.actionLink ? navigateTo(localePath(message.actionLink)) : undefined },
          }] "
          class="mb-3"
        />

        <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          <SearchProductCardPlaceholder
            v-for="(shop, index) in shopDomain"
            :key="index"
            :query="query"
            :product-placeholder="shop"
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
