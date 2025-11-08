<script setup lang="ts">
import { Analytics } from '@vercel/analytics/nuxt'
import { SpeedInsights } from '@vercel/speed-insights/nuxt'

const { t } = useI18n()
const title = t('welcome.title')
const description = t('welcome.description')
useSeoMeta({
  title,
  titleTemplate: (titleChunk) => {
    return titleChunk ? `${titleChunk} - GoSpendl` : 'GoSpendl'
  },
  ogTitle: title,
  description,
  ogDescription: description,
  ogImage: '/logo-light.png',
  twitterCard: 'summary_large_image',
})
</script>

<template>
  <UApp>
    <LayoutHeader />
    <UMain>
      <NuxtLayout>
        <UContainer class="py-6">
          <NuxtPage />
        </UContainer>
      </NuxtLayout>
    </UMain>
    <USeparator icon="i-custom-gospendl" type="dashed" class="h-px text-red" />
    <LayoutFooter />
    <Analytics />
    <SpeedInsights />
  </UApp>
</template>
