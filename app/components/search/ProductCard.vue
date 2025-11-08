<script lang="ts" setup>
import type { AlgoliaProduct } from '~~/types/algolia'
import { AisHighlight } from 'vue-instantsearch/vue3/es'
import shopDomains from '~/assets/shop-domain'

const props = defineProps<{
  product: AlgoliaProduct
}>()
defineEmits<{
  (e: 'clickOrder'): void
}>()

const shopDomain = computed(() => {
  if (!props.product.shopDomain)
    return null
  const domain = shopDomains.find(d => d.domain === props.product.shopDomain)
  if (!domain)
    return null
  return domain
})
</script>

<!-- A card component to display product information with image, price, and discounts -->
<template>
  <UCard class="product-card flex flex-col" variant="subtle" :ui="{ body: 'flex-grow flex flex-col' }">
    <template #header>
      <div class="flex justify-between items-center">
        <span class="font-semibold dark:text-neutral">{{ product.brand }}</span>

        <img
          v-if="shopDomain"
          :src="shopDomain.logoUrl"
          :alt="shopDomain.name"
          class="h-[24px]"
        >
      </div>
    </template>

    <!-- Product Image. TODO remove .imageUrl is deprecated but for now weve old products in the index  -->
    <img
      :src="product.imageSrc || product.imageUrl"
      :srcset="product.imageSrcset"
      :alt="product.name"
      class="w-full h-32 object-contain mb-4"
    >

    <!-- Product Title -->
    <h3 class="text-lg font-semibold mb-2 flex-grow dark:text-neutral">
      <AisHighlight attribute="name" :hit="product" />
    </h3>

    <!-- Price and Discount Section -->
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-lg font-bold dark:text-neutral">{{ product.price }} €</span>

        <!-- Bitcoin Discount Badge -->
        <UBadge
          v-if="product.group === 'payWithBitcoin'"
          color="warning"
          class="ml-2"
        >
          <UIcon name="i-lucide-bitcoin" class="size-6" />
          {{ $t('product.btcDiscount', { percent: 3 }) }}
        </UBadge>

        <!-- Satsback Badge -->
        <UBadge
          v-if="shopDomain?.satsbackPercent"
          color="secondary"
          class="ml-2"
        >
          <UIcon name="i-custom-satsback" class="size-6" />
          <span class="dark:text-white">{{ shopDomain.satsbackPercent }}% Satsback</span>
        </UBadge>
      </div>
    </div>

    <!-- Details Link -->
    <template #footer>
      <a
        :href="product.sourceUrl"
        target="_blank"
      >
        <UButton
          class="cursor-pointer"
          color="primary"
          variant="soft"
          icon="i-lucide-shopping-cart"
          block
          @click="$emit('clickOrder')"
        >
          {{ $t('product.order') }}
          <template #trailing>
            <UIcon name="i-lucide-arrow-right" class="size-5" />
          </template>
        </UButton>
      </a>
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
