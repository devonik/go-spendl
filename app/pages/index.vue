<script setup lang="ts">
const { t } = useI18n()

const features = ref([
  {
    title: t('welcome.feature1.title'),
    description: t('welcome.feature1.description'),
    icon: 'i-lucide-bitcoin'
  },
  {
    title: t('welcome.feature2.title'),
    description: t('welcome.feature2.description'),
    icon: 'i-custom-satsback'
  },
  {
    title: t('welcome.feature2.title'),
    description: t('welcome.feature2.description'),
    icon: 'i-lucide-sun-moon'
  }
])
</script>

<template>
  <UPageSection
    :title="$t('welcome.title')"
    :description="$t('welcome.description')"
    :features="features"
  />
</template>
