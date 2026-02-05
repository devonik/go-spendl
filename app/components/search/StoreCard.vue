<script lang="ts" setup>
import type { Store } from '~~/types/types'

defineProps<{
  store: Store
  query?: string
}>()
defineEmits<{
  (e: 'clickOrder'): void
}>()

const satsbackApi = useSatsbackApi()

const isStoreLinkLoading = ref(false)

async function redirectToStore(store: Store) {
  if (store.group === 'satsback') {
    isStoreLinkLoading.value = true
    satsbackApi.getStoreLink(store.store_id).then((redirectUrl) => {
      if (redirectUrl)
        window.open(redirectUrl, '_blank')
    }).finally(() => {
      isStoreLinkLoading.value = false
    })
  }
  else {
    window.open('https://shopinbit.com', '_blank')
  }
}
</script>

<!-- A card component to display product information with image, price, and discounts -->
<template>
  <UCard class="flex flex-col items-center p-6" variant="subtle" :ui="{ body: 'grow flex flex-col justify-between' }">
    <template #header>
      <div class="flex justify-between items-center">
        <img
          v-if="store"
          :src="store.image"
          :alt="store.name"
          class="h-6"
        >
      </div>
    </template>
    <h3 class="text-lg font-semibold mb-2 grow dark:text-neutral">
      {{ store.name }}
    </h3>
    <!-- Price and Discount Section -->
    <div class="space-y-2">
      <!-- Bitcoin Discount Badge -->
      <UBadge
        v-if="store.group === 'payWithBitcoin'"
        color="warning"
      >
        <UIcon name="i-lucide-bitcoin" class="size-6" />
        {{ $t('product.btcDiscount', { value: store.discountValue }) }}
      </UBadge>

      <!-- Satsback Badge -->
      <UBadge
        v-else-if="store.text"
        color="secondary"
      >
        <UIcon name="i-custom-satsback" class="size-6" />
        <span class="dark:text-white">{{ store.text }}</span>
      </UBadge>
    </div>
    <template #footer>
      <UButton
        class="cursor-pointer"
        color="primary"
        variant="soft"
        icon="i-lucide-shopping-cart"
        :loading="isStoreLinkLoading"
        loading-icon="i-lucide-loader"
        block
        @click="redirectToStore(store)"
      >
        {{ $t('product.order') }}
        <template #trailing>
          <UIcon name="i-lucide-arrow-right" class="size-5" />
        </template>
      </UButton>
    </template>
  </UCard>
</template>

<style scoped>
.product-card {
  transition: transform 0.2s ease-in-out;
}

.product-card:hover {
  transform: translateY(-4px);
}
</style>
