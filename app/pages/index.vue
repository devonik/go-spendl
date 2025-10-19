<script setup lang="ts">
const { t } = useI18n()
const router = useRouter()
const localePath = useLocalePath()

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
const searchModel = ref('')
</script>

<template>
  <div>
  <UPageSection
    :title="$t('welcome.title')"
    :description="$t('welcome.description')"
    :features="features"
  />
  <UInput v-model="searchModel" icon="i-lucide-search" :placeholder="$t('search.placeholder')" class="w-full" @change="router.replace(localePath(`/search?q=${searchModel}`))" />
  </div>
</template>
