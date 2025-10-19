<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const route = useRoute()
const localePath = useLocalePath()
const colorMode = useColorMode()

const items = computed<NavigationMenuItem[]>(() => [
{
  label: 'Home',
  to: localePath('/'),
  active: route.path === localePath('/')
},
{
  label: 'Search',
  to: localePath('/search'),
  active: route.path === localePath('/search')
},{
  label: 'About',
  to: localePath('/about'),
  active: route.path.startsWith(localePath('/about'))
}])

const logoUrl = computed(() => {
    return colorMode.value === 'dark' ? '/logo-dark.png' : '/logo-light.png'
})
</script>

<template>
  <UHeader mode="drawer">
<template #left>
    <NuxtLink class="font-bold" :to="localePath('/')">
      <img :src="logoUrl" alt="Go Spendl Logo" width="80" >
    </NuxtLink>
</template>
    <UNavigationMenu :items="items" />

    <template #right>
      <UColorModeButton />
    </template>
    <template #body>
        <UNavigationMenu :items="items" orientation="vertical" class="-mx-2.5" />
      </template>
  </UHeader>
</template>
