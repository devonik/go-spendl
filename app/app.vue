<script setup lang="ts">
import { error } from 'node:console'

import { Analytics } from '@vercel/analytics/nuxt'
import { SpeedInsights } from '@vercel/speed-insights/nuxt'

const { t } = useI18n()
const toast = useToast()
const localePath = useLocalePath()

const title = t('welcome.title')
const description = t('welcome.description')
const messages = ref<string>()

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

interface WebsocketJsonMessage {
  source: string
  meta: Record<string, string>
}
const { open } = useWebSocket('/ws', {
  immediate: false,
  async onMessage(ws, event) {
    try {
      const json: WebsocketJsonMessage = JSON.parse(event.data)
      if (json.source === 'crawl.newData') {
        toast.add({
          title: 'New data available',
          description: `${json.meta.itemCount} new items available. You can search now for ${json.meta.initialQuery}`,
          color: 'success',
          icon: 'i-lucide-search',
          actions: [{
            icon: 'i-lucide-search',
            label: `Search`,
            color: 'neutral',
            variant: 'outline',
            onClick: (e) => {
              navigateTo(localePath(`/search?q=${json.meta.initialQuery}`))
              e?.stopPropagation()
            },
          }],
        })
      }
      else {
        toast.add({
          title: 'New message',
          description: typeof event.data === 'string' ? event.data : await event.data.text(),
          color: 'primary',
          icon: 'i-lucide-info
        })
      }
    }
    catch (error) {
      console.error('Could not parse json from websocket image', error, event)
    }
  },
})

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
