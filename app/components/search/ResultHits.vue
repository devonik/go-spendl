<script lang="ts" setup>
import type { Locale } from 'vue-i18n'
import type { AlgoliaProduct } from '~/types/algolia'
import { AisInfiniteHits } from 'vue-instantsearch/vue3/es'
import shopDomain from '~/assets/shop-domain'

const page = defineModel('page', {
  type: Number,
  required: false,
  default: 1,
})
const query = defineModel('query', {
  type: String,
  required: true,
})
const { locale } = useI18n()

const productsPlaceholder = shopDomain.map(domain => ({
  ...domain,
  sourceUrl: domain.getSearchUrl ? domain.getSearchUrl(query.value, locale.value) : '',
}))
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
      <div v-if="page > 1" class="justify-self-center mb-3">
        <UButton
          color="primary"
          :label="isLastPage ? $t('search.noMoreResults') : $t('search.showMoreResults')" @click=" () => {
            page--
            refinePrevious()
          }"
        />
      </div>

      <div v-if="items.length > 0" class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        <SearchProductCard
          v-for="product in items"
          :key="product.objectID"
          :product="product"
          @click-order="sendEvent('conversion', product, 'User clicked on order button')"
        />
      </div>
      <div v-else>
        <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          <SearchProductCardPlaceholder
            v-for="(placeholder, index) in productsPlaceholder"
            :key="index"
            :product-placeholder="placeholder"
            @click-order="null"
          />
        </div>
      </div>

      <div class="justify-self-center mt-3">
        <UButton
          :label="isLastPage ? $t('search.noMoreResults') : $t('search.showMoreResults')" :disabled="isLastPage" @click=" () => {
            page++
            refineNext()
          }"
        />
      </div>
    </template>
  </AisInfiniteHits>
</template>

<style scoped>

</style>
