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

const messages = ref<string>()
const { open } = useWebSocket('/ws', {
  immediate: false,
  async onMessage(ws, event) {
    console.log('onMessage', ws, event.data)
    // We parse the number of connected users from the message
    // The message might be a string or a Blob
    messages.value = typeof event.data === 'string' ? event.data : await event.data.text()
  },
})

// We open the connection when the component is mounted
onMounted(() => {
  open()
})
</script>

<template>
  <UApp>
    <LayoutHeader />
    <UMain>
      <NuxtLayout>
        <UContainer class="py-6">
          <NuxtPage />
          <pre>{{ messages }}</pre>
        </UContainer>
      </NuxtLayout>
    </UMain>
    <USeparator icon="i-custom-gospendl" type="dashed" class="h-px text-red" />
    <LayoutFooter />
    <Analytics />
    <SpeedInsights />
  </UApp>
</template>
