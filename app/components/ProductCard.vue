<script lang="ts" setup>
import shopDomains from '~/assets/shop-domain';

const props = defineProps<{
  product: Product
}>()

const localePath = useLocalePath()

const shopDomain = computed(() => {
  if(!props.product.shopDomain) return null
  const domain = shopDomains.find(d => d.domain === props.product.shopDomain)
  if(!domain) return null
  return domain
})

</script>

<!-- A card component to display product information with image, price, and discounts -->
<template>
  <UCard class="product-card">
    <div class="flex justify-between items-center mb-2">
        <span class="ml-2 font-semibold">{{ product.brand }}</span>

        <img
            v-if="shopDomain"
            :src="shopDomain.logoUrl"
            :alt="shopDomain.name"
            >
    </div>
    
    <!-- Product Image -->
    <img
      :src="product.imageUrl"
      :alt="product.name"
      class="w-full h-48 object-contain mb-4">

    <!-- Product Title -->
    <h3 class="text-lg font-semibold mb-2 line-clamp-2">{{ product.name }}</h3>

    <!-- Price and Discount Section -->
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-lg font-bold">{{ product.price.toString().replaceAll('.', ',') }}€</span>
        
        
        <!-- Bitcoin Discount Badge -->
        <UBadge
          v-if="product.bitcoinDiscount"
          color="warning"
          class="ml-2"
        >
          {{ product.bitcoinDiscount.percent }}% BTC Discount
        </UBadge>
        
        <!-- Satsback Badge -->
        <UBadge
          v-if="shopDomain?.satsbackPercent"
          color="secondary"
          class="ml-2"
        >
        <UIcon name="i-custom-satsback" class="size-6"/> 
          {{ shopDomain.satsbackPercent }}% Satsback
        </UBadge>
      </div>

      <!-- Discounted Price -->
      <p v-if="product.bitcoinDiscount" class="text-sm text-green-600 dark:text-green-400">
        Final Price: {{ product.bitcoinDiscount.finalPrice }}
      </p>
    </div>

    <!-- Details Link -->
    <div class="mt-4">
      <UButton
        :href="product.sourceUrl"
        _target="_blank"
        color="primary"
        variant="soft"
        block
      >
        Order on partner site
      </UButton>
    </div>
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