<script setup lang="ts">
definePageMeta({
  title: 'welcome.title',
})

const { t } = useI18n()
const router = useRouter()
const localePath = useLocalePath()

const features = ref([
  {
    title: t('welcome.feature1.title'),
    description: t('welcome.feature1.description'),
    icon: 'i-lucide-bitcoin',
  },
  {
    title: t('welcome.feature2.title'),
    description: t('welcome.feature2.description'),
    icon: 'i-custom-satsback',
  },
  {
    title: t('welcome.feature3.title'),
    description: t('welcome.feature3.description'),
    icon: 'i-lucide-sun-moon',
  },
])
const searchModel = ref('')
</script>

<template>
  <div class="flex flex-col">
    <UPageSection
      :title="$t('welcome.title')"
      :features="features"
    >
      <template #description>
        <div class="flex flex-col gap-8">
          {{ $t('welcome.description') }}

          <UInput
            v-model="searchModel"
            icon="i-lucide-search"
            :placeholder="$t('search.placeholder')"
            class="m-auto min-w-[150px] max-w-lg w-full"
            @change="router.replace(localePath(`/search?q=${searchModel}`))"
          />
        </div>
      </template>
    </UPageSection>
  </div>
</template>
