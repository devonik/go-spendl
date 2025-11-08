<script lang="ts" setup>
import type shopDomains from '~/assets/shop-domain'

const props = defineProps<{
  productPlaceholder: typeof shopDomains[0]
  query: string
}>()
defineEmits<{
  (e: 'clickOrder'): void
}>()

const { locale } = useI18n()

const sourceUrl = computed(() => {
  return props.productPlaceholder.getSearchUrl ? props.productPlaceholder.getSearchUrl(props.query, locale.value) : ''
})
</script>

<!-- A card component to display product information with image, price, and discounts -->
<template>
  <UCard class="flex flex-col items-center p-6" variant="subtle">
    <template #header>
      <div class="flex justify-between items-center">
        <img
          v-if="productPlaceholder"
          :src="productPlaceholder.logoUrl"
          :alt="productPlaceholder.name"
          class="h-[24px]"
        >
      </div>
    </template>
    <div class="justify-items-center">
      <h3 class="text-lg font-semibold mb-2 flex-grow dark:text-neutral">
        {{ productPlaceholder.domain }}
      </h3>
      <!-- Price and Discount Section -->
      <div class="space-y-2">
        <!-- Bitcoin Discount Badge -->
        <UBadge
          v-if="productPlaceholder.group === 'payWithBitcoin'"
          color="warning"
        >
          <UIcon name="i-lucide-bitcoin" class="size-6" />
          {{ $t('product.btcDiscount', { percent: 3 }) }}
        </UBadge>

        <!-- Satsback Badge -->
        <UBadge
          v-if="productPlaceholder.satsbackPercent"
          color="secondary"
        >
          <UIcon name="i-custom-satsback" class="size-6" />
          <span class="dark:text-white">{{ productPlaceholder.satsbackPercent }}% Satsback</span>
        </UBadge>
      </div>
    </div>
    <template #footer>
      <a
        :href="sourceUrl"
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
