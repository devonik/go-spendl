<script setup lang="ts">
definePageMeta({
  title: 'welcome.title',
})
const localePath = useLocalePath()

const searchModel = ref('')
</script>

<template>
  <div class="flex flex-col">
    <UPageSection
      :title="$t('welcome.title')"
      :ui="{ container: 'py-4 sm:py-12 lg:py-20' }"
    >
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
    </UPageSection>
  </div>
</template>

<style>
.iconify+.i-lucide:bitcoin{
  color: red !important;
}
</style>
