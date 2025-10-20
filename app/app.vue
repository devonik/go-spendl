<script setup lang="ts">
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
    <USeparator icon="i-simple-icons-nuxtdotjs" type="dashed" class="h-px" />
    <LayoutFooter />
  </UApp>
</template>
