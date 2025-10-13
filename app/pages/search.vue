<script lang="ts" setup>

import { useRouteQuery } from '@vueuse/router'
const route = useRoute()

const page = useRouteQuery('page', '1', { transform: Number })

const isLoading = ref(true)
const { result, search } = await useAlgoliaSearch('dev_products')

async function execSearch() {
  isLoading.value = true
  await search({
    query: route.query.q?.toString() || '',
    requestOptions: { page: page.value - 1}
  })
  setTimeout( () => {
      window.scrollTo(0, 0);
  }, 100 );
  isLoading.value = false
}
execSearch()
</script>

<template>
  <UContainer>
    <div class="py-8">
      <!-- Search Results Header -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold mb-2">
          Search Results
          <span v-if="route.query.q" class="text-gray-500">
            for "{{ route.query.q }}"
          </span>
        </h1>
        <p v-if="!isLoading" class="text-gray-500">
          {{ result?.nbHits}} products found
        </p>
      </div>
      <!-- Products Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">

        <template v-if="isLoading && !result?.hits.length">
          <USkeleton class="h-[400px] w-[300px]" />
          <USkeleton class="h-[400px] w-[300px]" />
          <USkeleton class="h-[400px] w-[300px]" />
        </template>

        <ProductCard
          v-for="product in result?.hits"
          :key="product.objectID"
          :product="product"
        />
      </div>

      <!-- No Results Message -->
      <div v-if="!isLoading && result?.hits.length === 0" class="text-center py-12">
        <UIcon
          name="i-heroicons-magnifying-glass-circle"
          class="text-gray-400 w-16 h-16 mx-auto mb-4"
        />
        <h2 class="text-xl font-semibold mb-2">No products found</h2>
        <p class="text-gray-500">
          Try adjusting your search terms or browse all products
        </p>
      </div>
    </div>
    <UPagination v-model:page="page" class="justify-self-center" show-edges :items-per-page="result?.hitsPerPage" :total="result?.nbHits" @update:page="execSearch()" />
  </UContainer>
</template>

<style scoped>
</style>