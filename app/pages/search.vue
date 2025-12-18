<script lang="ts" setup>
import { useRouteQuery } from '@vueuse/router'
import { liteClient as algoliasearch } from 'algoliasearch/lite'
import { AisConfigure, AisInstantSearch, AisPoweredBy, AisSortBy, AisStateResults } from 'vue-instantsearch/vue3/es'

definePageMeta({
  title: 'search.title',
})

const { t } = useI18n()
const { error } = await useFetch('/api/algolia/health')
const { data } = await useFetch('/api/algolia/api')
const config = useRuntimeConfig()

const searchClient = algoliasearch(
  config.public.algoliaAppId,
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
      :index-name="config.public.algoliaProductIndex"
      class="flex flex-col md:flex-row gap-6"
      :insights="true"
      :future="{
        preserveSharedStateOnUnmount: true,
      }"
      :initial-ui-state="{
        [config.public.algoliaProductIndex]: {
          query: queryModel,
          page: pageModel,
        },
      }"
    >
      <AisStateResults>
        <SearchFilter />
      </AisStateResults>

      <div class="flex flex-col gap-6 grow">
        <SearchDebouncedSearchBox
          v-model="queryModel"
          :delay="500"
          :placeholder="$t('search.placeholder')"
        />
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
            <template #default="{ items, refine }">
              <USelect
                :items="items"
                :placeholder="$t('search.sortBy.price.placeholder')"
                :ui="{ content: 'min-w-fit' }"
                @update:model-value="value => refine(value)"
              />
            </template>
          </AisSortBy>
        </div>
        <SearchResultHits v-model:page="pageModel" v-model:query="queryModel" />
        <AisConfigure
          :hits-per-page.camel="20"
        />
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
