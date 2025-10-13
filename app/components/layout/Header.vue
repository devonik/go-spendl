<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const route = useRoute()
const localePath = useLocalePath()


const items = computed<NavigationMenuItem[]>(() => [
{
  label: 'Home',
  to: localePath('/'),
  active: route.path === localePath('/')
},{
  label: 'About',
  to: localePath('/about'),
  active: route.path.startsWith(localePath('/about'))
}])
</script>

<template>
  <UHeader mode="drawer">
<template #left>
    <NuxtLink class="font-bold" :to="localePath('/')">Deflacheck</NuxtLink>
</template>
    <UNavigationMenu :items="items" />

    <template #right>
        <SearchBar />
      <UColorModeButton />
    </template>
    <template #body>
        <UNavigationMenu :items="items" orientation="vertical" class="-mx-2.5" />
      </template>
  </UHeader>
</template>
