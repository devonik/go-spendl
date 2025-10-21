<script setup lang="ts">
definePageMeta({
  title: 'about.aboutUs.title',
})
</script>

<template>
  <UPageSection
    :title="$t('about.aboutUs.title')"
    :description="$t('about.aboutUs.text')"
    orientation="horizontal"
    :ui="{ container: 'py-4 sm:py-12 lg:py-20' }"
  >
    <template #features>
      <UPageFeature
        :title="$t('about.ourMission.title')"
        :description="$t('about.ourMission.text')"
        icon="i-lucide-star"
      />
      <UPageFeature
        :title="$t('about.howWeWork.title')"
        :description="$t('about.howWeWork.text')"
        icon="i-custom-network"
      />
      <UPageFeature
        :title="$t('about.security.title')"
        :description="$t('about.security.text')"
        icon="i-lucide-lock"
      />
      <UPageFeature
        :title="$t('about.contact.title')"
        :description="$t('about.contact.text')"
        icon="i-lucide-contact"
      >
        <template #description>
          <i18n-t keypath="about.contact.text" tag="p">
            <template #email>
              <a href="mailto:info@gospendl.com" class="font-medium text-blue-600 dark:text-blue-500 hover:underline">info@gospendl.com</a>
            </template>
          </i18n-t>
        </template>
      </UPageFeature>
    </template>
    <img
      src="/about-hero.png"
      width="352"
      height="647"
      alt="Illustration"
      class="w-full rounded-lg"
    >
  </UPageSection>
</template>
