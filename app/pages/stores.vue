<script setup lang="ts">
import type { Store } from '~~/types/types'

definePageMeta({
  title: 'welcome.title',
})

const { data: stores, pending: storesPending } = useLazyFetch<Store[]>(`/api/stores?country=germany`)

const selectedCategory = ref<string | null>(null)

const visibleStores = computed(() => {
  if (!stores.value) return []
  if (!selectedCategory.value) return stores.value
  return stores.value.filter(store => store.category === selectedCategory.value)
})
</script>

<template>
  <UPageSection
    :title="$t('stores.title')"
    :ui="{ container: 'py-4 sm:py-4 lg:py-4' }"
  >
    <template #description>
      <CategoriesAutocomplete
        v-if="!storesPending"
        class="mb-6"
        @change="value => selectedCategory = value ?? null"
      />
      <div
        class="overflow-auto flex flex-row flex-wrap gap-6 justify-center"
      >
        <UProgress v-if="storesPending" animation="swing" />
        <SearchStoreCard
          v-for="(shop, index) in visibleStores"
          :key="index"
          class="basis-1/2 md:basis-1/3 lg:basis-1/4"
          :store="shop"
        />
      </div>
    </template>
  </UPageSection>
</template>

<style>
.iconify+.i-lucide:bitcoin{
  color: red !important;
}
</style>
