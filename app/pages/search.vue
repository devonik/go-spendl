<script lang="ts" setup>
import type { AlgoliaProduct } from '~/types/algolia'
import { useRouteQuery } from '@vueuse/router'
import { liteClient as algoliasearch } from 'algoliasearch/lite'
import { AisConfigure, AisInfiniteHits, AisInstantSearch, AisPoweredBy, AisSearchBox, AisSortBy, AisStateResults, AisVoiceSearch } from 'vue-instantsearch/vue3/es'

definePageMeta({
  title: 'search.title',
})

const { t } = useI18n()
const { error } = await useFetch('/api/algolia/health')
const { data } = await useFetch('/api/algolia/api')

const searchClient = algoliasearch(
  'EFU0EZXFMM',
  data.value,
)

const pageModel = useRouteQuery('p', '1', { transform: Number })
const queryModel = useRouteQuery('q', '')
</script>

<template>
  <h2 class="text-3xl sm:text-4xl lg:text-5xl text-pretty tracking-tight font-bold text-highlighted text-center mb-6">
    {{ $t('search.title') }}
  </h2>
  <ClientOnly>
    <template #fallback>
      <!-- this will be rendered on server side -->
      <div>
        <UProgress indeterminate />
      </div>
    </template>
    <div v-if="error">
      {{ $t('noInternet') }}
    </div>
    <AisInstantSearch
      v-else
      :search-client="searchClient"
      index-name="prod_products"
      class="flex flex-col md:flex-row gap-6"
      :insights="true"
      :future="{
        preserveSharedStateOnUnmount: true,
      }"
      :initial-ui-state="{
        prod_products: {
          query: queryModel,
          page: pageModel,
        },
      }"
    >
      <AisStateResults>
        <SearchFilter />
      </AisStateResults>

      <div class="flex flex-col gap-6 flex-grow">
        <AisSearchBox>
          <template #default="{ isSearchStalled, refine }">
            <UInput
              v-model="queryModel" class="w-full" :placeholder="$t('search.placeholder')" @update:model-value="value => refine(value)"
            >
              <template #trailing>
                <span :hidden="!isSearchStalled" class="mr-3">{{ $t('search.loading') }}</span>
                <AisVoiceSearch />
              </template>
            </UInput>
          </template>
          <template #submit-icon>
            🔎
          </template>
        </AisSearchBox>
        <!-- <ais-autocomplete >
        <template #default="{ currentRefinement, indices, refine }">
          currentRefinement: {{ currentRefinement }}
          <UInputMenu
            :model-value="currentRefinement" icon="i-lucide-search" placeholder="Search product..." :items="[
            {
              type: 'separator'
            },
            {
              type: 'label',
              label: 'Satsback'
            },

            ...indices.map(i => i.hits).flat().map(hit => ({
              label: hit.name,
              imageUrl: hit.imageUrl,
              price: `$${hit.price}`,
              bitcoinDiscount: hit.bitcoinDiscount ? { finalPrice: `$${(hit.price * (1 - hit.bitcoinDiscount / 100)).toFixed(2)}` } : undefined,
              satsbackPercent: hit.satsbackPercent
            }))
          ]" class="w-full" @update:model-value="(value) => refine(value.label)">
            <template #item="{ item, index}">
                    <div class="w-full flex items-center">
                        <nuxt-img :src="item.imageUrl" class="w-6 h-6 rounded-full mr-2" />
                        <span>{{ item.label }}</span>
                    </div>
                    <div class="flex mt-1 text-sm text-muted font-medium">
                        <div class="mr-3">
                            <span class="" :class="{'line-through' : item.bitcoinDiscount}">{{ item.price }}</span>
                        </div>
                        <div v-if="item.bitcoinDiscount" class="text-yellow-500 flex gap-1">
                            <UIcon name="i-lucide-bitcoin" class="size-6 text-yellow-500" />
                            <span class="m-auto">{{item.bitcoinDiscount.finalPrice }}</span>
                        </div>
                        <div v-else-if="item.satsbackPercent" class="flex gap-1">
                            <UIcon name="i-custom-satsback" class="size-6"/>
                            <span class="m-auto">{{ item.satsbackPercent }}% Satsback</span>
                        </div>
                    </div>
            </template>
          </UInputMenu>
        </template>
      </ais-autocomplete> -->
        <div class="flex justify-between gap-4">
          <AisStateResults>
            <template #default="{ status, state: { query }, results: { nbHits, processingTimeMS } }">
              <p v-show="status === 'stalled'">
                <UProgress animation="swing" />
              </p>
              <i18n-t keypath="search.info" tag="p">
                <template #hits>
                  <strong>{{ nbHits }}</strong>
                </template>
                <template #time>
                  <strong>{{ processingTimeMS }}</strong>
                </template>
                <template #query>
                  <q>{{ query }}</q>
                </template>
              </i18n-t>
            </template>
          </AisStateResults>

          <!-- Sort -->
          <AisSortBy
            :items="[
              { value: 'prod_products_price_asc', label: t('search.sortBy.price.asc'), icon: 'i-lucide-arrow-up' },
              { value: 'prod_products_price_desc', label: t('search.sortBy.price.desc'), icon: 'i-lucide-arrow-down' },
            ]"
          >
            <template #default="{ items, currentRefinement, refine }">
              <USelect
                :items="items"
                :placeholder="$t('search.sortBy.price.placeholder')"
                :ui="{ content: 'min-w-fit' }"
                @update:model-value="value => refine(value)"
              />
            </template>
          </AisSortBy>
        </div>
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
            <div v-if="pageModel > 1" class="justify-self-center mb-3">
              <UButton
                color="primary"
                :label="isLastPage ? $t('search.noMoreResults') : $t('search.showMoreResults')" @click=" () => {
                  pageModel--
                  refinePrevious()
                }"
              />
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              <ProductCard
                v-for="product in items"
                :key="product.objectID"
                :product="product"
                @click-order="sendEvent('conversion', product, 'User clicked on order button')"
              />
            </div>
            <div class="justify-self-center mt-3">
              <UButton
                :label="isLastPage ? $t('search.noMoreResults') : $t('search.showMoreResults')" :disabled="isLastPage" @click=" () => {
                  pageModel++
                  refineNext()
                }"
              />
            </div>
          </template>
        </AisInfiniteHits>
        <AisConfigure
          :hits-per-page.camel="20"
        />
        <!-- <ais-pagination >
        <template
            #default="{
              currentRefinement,
              nbPages,
              nbHits,
              pages,
              isFirstPage,
              isLastPage,
              refine,
              createURL,
            }"
          >
          <UPagination
            v-model:page="page"
            class="justify-self-center"
            show-edges
            :items-per-page="20"
            :total="nbHits"
            @update:page="value => refine(value)" />
        </template>
      </ais-pagination> -->
        <AisStateResults>
          <AisPoweredBy />
        </AisStateResults>
      </div>
    </AisInstantSearch>
  </ClientOnly>
</template>

<style>
.ais-PoweredBy-logo{
 width: 100px !important;
}
</style>
