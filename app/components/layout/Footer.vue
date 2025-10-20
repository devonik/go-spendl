<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import type { Locale } from 'vue-i18n'
import { de, en, es } from '@nuxt/ui/locale'

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
        :locales="[en, de, es]"
        @update:model-value="switchLanguage($event)"
      />
    </template>
  </UFooter>
</template>
