<script setup lang="ts">
const { t } = useI18n()
const features = ref([
  {
    title: t('about.ourMission.title'),
    description: t('about.ourMission.text'),
    icon: 'i-lucide-star',
  },
  {
    title: t('about.howWeWork.title'),
    description: t('about.howWeWork.text'),
    icon: 'i-lucide-network',
  },
  {
    title: t('about.security.title'),
    description: t('about.security.text'),
    icon: 'i-lucide-lock',
  },
  {
    title: t('about.contact.title'),
    description: t('about.contact.text'),
    icon: 'i-lucide-contact',
  },
])
</script>

<template>
  <UPageSection
    :title="t('about.aboutUs.title')"
    :description="t('about.aboutUs.text')"
    orientation="horizontal"
    :features="features"
    :ui="{ container: 'py-4 sm:py-12 lg:py-20' }"
  >
    <img
      src="/about-hero.png"
      width="352"
      height="647"
      alt="Illustration"
      class="w-full rounded-lg"
    >
  </UPageSection>
</template>
