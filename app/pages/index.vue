<script setup lang="ts">
import type { Store } from '~~/types/types'

definePageMeta({
  title: 'welcome.title',
})
const localePath = useLocalePath()

const searchModel = ref('')

const { data: stores, pending: storesPending } = useLazyFetch<Store[]>(`/api/stores?country=germany`)
</script>

<template>
  <div class="flex flex-col">
    <UPageSection
      :title="$t('welcome.title')"
      :ui="{ container: 'py-4 sm:py-12 lg:py-20' }"
    >
      <template #description>
        <div class="flex flex-col gap-8">
          {{ $t('welcome.description') }}

          <UInput
            v-model="searchModel"
            icon="i-lucide-search"
            :placeholder="$t('search.placeholder')"
            class="m-auto min-w-[150px] max-w-lg w-full"
            @change="navigateTo(localePath(`/search?q=${searchModel}`))"
          />
        </div>
      </template>

      <template #features>
        <UPageFeature
          :title="$t('welcome.feature1.title')"
          :description="$t('welcome.feature1.description')"
          icon="i-lucide-bitcoin"
          :ui="{ leadingIcon: 'text-[#f7931a]' }"
        />
        <UPageFeature
          :title="$t('welcome.feature2.title')"
          :description="$t('welcome.feature2.description')"
          icon="i-custom-satsback"
        />
        <UPageFeature
          :title="$t('welcome.feature3.title')"
          :description="$t('welcome.feature3.description')"
          icon="i-lucide-rocket"
        />
      </template>
    </UPageSection>
    <UPageSection
      :title="$t('welcome.ourPartners')"
      :ui="{ container: 'pt-0!', title: 'text-2xl sm:text-3xl lg:text-4xl pb-3' }"
    >
      <template #description>
        <UScrollArea
          class="h-150 w-full overflow-auto" :ui="{ viewport: 'gap-4 flex flex-row flex-wrap gap-6 justify-center' }"
        >
          <UProgress v-if="storesPending" animation="swing" />
          <SearchStoreCard
            v-for="(shop, index) in stores"
            :key="index"
            class="flex-auto"
            :store="shop"
          />
        </UScrollArea>
      </template>
    </UPageSection>
  </div>
</template>

<style>
.iconify+.i-lucide:bitcoin{
  color: red !important;
}
</style>
