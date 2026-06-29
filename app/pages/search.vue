<script lang="ts" setup>
import { useRouteQuery } from '@vueuse/router'
import { liteClient as algoliasearch } from 'algoliasearch/lite'
import { AisConfigure, AisInstantSearch, AisMenuSelect, AisPoweredBy, AisSortBy, AisStateResults } from 'vue-instantsearch/vue3/es'

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

// Nuxt UI's USelect (radix-vue) refuses empty-string SelectItem values, so we
// use a non-empty sentinel for the "All categories" option and translate
// to/from Algolia's empty-string-clears-refinement convention at the boundary.
const ALL_CATEGORIES = '__all__'

function buildCategoryOptions(items: { value: string, count: number }[]) {
  return [
    { value: ALL_CATEGORIES, label: t('search.filter.allCategories') },
    ...items.map(i => ({ value: i.value, label: `${t(i.value)} (${i.count})` })),
  ]
}

function currentCategoryValue(items: { value: string, isRefined: boolean }[]) {
  return items.find(i => i.isRefined)?.value ?? ALL_CATEGORIES
}
</script>

<template>
  <UPageSection
    :title="$t('search.title')"
    :ui="{ container: 'py-4 sm:py-4 lg:py-4' }"
  >
    <template #description>
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
            <!-- Amazon-style category prefix on the search bar. Lets the user narrow
                 the result set (and any future crawl fan-out) before typing a query. -->
            <div class="flex items-stretch gap-0">
              <AisMenuSelect attribute="category" :limit="20">
                <template #default="{ items, refine }">
                  <USelect
                    :model-value="currentCategoryValue(items)"
                    :items="buildCategoryOptions(items)"
                    class="rounded-r-none border-r-0 min-w-fit"
                    :ui="{ content: 'min-w-fit' }"
                    @update:model-value="(v) => refine(v === ALL_CATEGORIES ? '' : v)"
                  />
                </template>
              </AisMenuSelect>
              <SearchDebouncedSearchBox
                v-model="queryModel"
                :delay="500"
                :placeholder="$t('search.placeholder')"
                class="grow rounded-l-none"
              />
            </div>
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
  </UPageSection>
</template>

<style>
.ais-PoweredBy-logo{
 width: 100px !important;
}
</style>
