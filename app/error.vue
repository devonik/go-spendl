<script setup lang="ts">
import type { NuxtError } from '#app'

defineProps<{
  error: NuxtError
}>()
</script>

<template>
  <UApp>
    <LayoutHeader/>

    <UError :error="error" />

    <LayoutFooter/>
  </UApp>
</template>
