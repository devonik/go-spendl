<script setup lang="ts">
import type { ButtonProps } from '@nuxt/ui'

definePageMeta({
  title: 'welcome.title',
})
const localePath = useLocalePath()
const { t } = useI18n()

const searchModel = ref('')

const links = ref<ButtonProps[]>([
  {
    label: t('welcome.link1.title'),
    to: localePath('/stores'),
    color: 'primary',
    variant: 'subtle',
    trailingIcon: 'i-lucide-arrow-right',
  },
])
</script>

<template>
  <div class="flex flex-col">
    <UPageSection
      :title="$t('welcome.title')"
      :ui="{ container: 'py-4 sm:py-4 lg:py-4' }"
      :links="links"
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
  </div>
</template>

<style>
.iconify+.i-lucide:bitcoin{
  color: red !important;
}
</style>
