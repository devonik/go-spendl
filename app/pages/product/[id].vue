<template>
  <UContainer>
    <div v-if="product" class="py-8">
      <!-- Back Button -->
      <UButton
        to="/search"
        variant="soft"
        color="neutral"
        icon="i-heroicons-arrow-left"
        class="mb-6"
      >
        Back to Search
      </UButton>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
        <!-- Product Image Section -->
        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
          <img
            :src="product.avatar.src"
            :alt="product.avatar.alt"
            class="w-full h-auto object-contain">
        </div>

        <!-- Product Details Section -->
        <div class="space-y-6">
          <!-- Brand & Title -->
          <div>
            <UBadge color="primary" class="mb-2">{{ productBrand }}</UBadge>
            <h1 class="text-2xl font-bold">{{ product.label }}</h1>
          </div>

          <!-- Price Section -->
          <div class="space-y-2">
            <!-- Original Price -->
            <div class="flex items-center gap-2">
              <span class="text-2xl font-bold">{{ product.price }}</span>
              
              <!-- Bitcoin Discount Badge -->
              <UBadge
                v-if="product.bitcoinDiscount"
                color="warning"
                size="lg"
              >
                {{ product.bitcoinDiscount.percent }}% BTC Discount
              </UBadge>
              
              <!-- Satsback Badge -->
              <UBadge
                v-if="product.satsbackPercent"
                color="secondary"
                size="lg"
              >
                {{ product.satsbackPercent }}% Satsback
              </UBadge>
            </div>

            <!-- Discounted Price -->
            <div v-if="product.bitcoinDiscount" class="flex items-center gap-2">
              <span class="text-xl font-semibold text-green-600 dark:text-green-400">
                Final Price: {{ product.bitcoinDiscount.finalPrice }}
              </span>
              <UTooltip text="Price after Bitcoin discount">
                <UButton
                  color="neutral"
                  variant="ghost"
                  icon="i-heroicons-information-circle"
                  square
                  size="xs"
                />
              </UTooltip>
            </div>

            <!-- Satsback Info -->
            <p v-if="product.satsbackPercent" class="text-sm text-gray-600 dark:text-gray-400">
              Earn {{ product.satsbackPercent }}% in Bitcoin rewards with this purchase
            </p>
          </div>

          <!-- Order Button -->
          <UButton
            :to="product.source"
            target="_blank"
            color="primary"
            size="lg"
            class="w-full sm:w-auto"
            icon="i-heroicons-shopping-cart"
          >
            Order Now
          </UButton>
        </div>
      </div>
    </div>

    <!-- Not Found State -->
    <div v-else class="py-16 text-center">
      <UIcon
        name="i-heroicons-exclamation-triangle"
        class="w-16 h-16 mx-auto mb-4 text-warning"
      />
      <h2 class="text-xl font-semibold mb-2">Product Not Found</h2>
      <p class="text-gray-500 mb-4">
        The product you're looking for doesn't exist or has been removed.
      </p>
      <UButton
        to="/search"
        color="primary"
      >
        Browse Products
      </UButton>
    </div>
  </UContainer>
</template>

<script setup lang="ts">
import products from '../../assets/products'

const route = useRoute()
const id = computed(() => route.params.id as string)

// Find the product based on the ID parameter
const product = computed(() => {
  return products.find(p => p.value === id.value)
})

// Extract brand name from product label (assumes format includes brand name)
const productBrand = computed(() => {
  if (!product.value) return ''
  
  // This example assumes the brand is the first word in the product label
  // You might want to adjust this logic based on your actual data structure
  return product.value.label.split(' ')[0]
})

// Handle 404 if product is not found
if (!product.value) {
  throw createError({
    statusCode: 404,
    message: 'Product not found'
  })
}
</script>