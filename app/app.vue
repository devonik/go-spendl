<script setup lang="ts">
import { Analytics } from '@vercel/analytics/nuxt'
import { SpeedInsights } from '@vercel/speed-insights/nuxt'

const { t, locale } = useI18n()

useSeoMeta({
  titleTemplate: titleChunk => titleChunk ? `${titleChunk} – GoSpendl` : 'GoSpendl – Preisvergleich für Bitcoiner',
  description: () => t('seo.site.description'),
  ogSiteName: 'GoSpendl',
  ogType: 'website',
  ogLocale: () => locale.value === 'de' ? 'de_DE' : 'en_US',
  twitterCard: 'summary_large_image',
})

useSchemaOrg([
  defineWebSite({
    name: 'GoSpendl',
    description: () => t('seo.site.description'),
  }),
  defineWebPage(),
])

defineOgImage('NuxtSeo.satori', {
  theme: '#f7931a',
  colorMode: 'dark',
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
