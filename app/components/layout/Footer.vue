<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import type { Locale } from 'vue-i18n'
import { de, en } from '@nuxt/ui/locale'

const { locale, setLocale, loadLocaleMessages } = useI18n()
const items: NavigationMenuItem[] = [
  /* {
    label: 'Figma Kit',
    to: 'https://go.nuxt.com/figma-ui',
    target: '_blank'
  }, */
]

async function switchLanguage(lang: Locale) {
  await loadLocaleMessages(lang)
  setLocale(lang)
}
</script>

<template>
  <UFooter>
    <template #left>
      <p class="text-muted text-sm">
        Copyright © {{ new Date().getFullYear() }}
      </p>
    </template>

    <UNavigationMenu :items="items" variant="link" />

    <template #right>
      <ULocaleSelect
        v-model="locale"
        :locales="[en, de]"
        @update:model-value="value => switchLanguage(value as Locale)"
      />
    </template>
  </UFooter>
</template>
