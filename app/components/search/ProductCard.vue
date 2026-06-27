<script lang="ts" setup>
import type { AlgoliaProduct } from '~~/types/algolia'
import { AisHighlight } from 'vue-instantsearch/vue3/es'

const props = defineProps<{
  product: AlgoliaProduct
}>()
defineEmits<{
  (e: 'clickOrder'): void
}>()

const { data: stores } = useStores()

const shopDomain = computed(() =>
  stores.value?.find(s => s.slug === props.product.shopDomain) ?? null,
)

const isSatsback = computed(() => shopDomain.value?.group === 'satsback' && shopDomain.value?.store_id)

const isModalOpen = ref(false)
const isNoCashbackOpen = ref(false)
const noCashbackReason = ref<'mobile' | 'no-extension'>('mobile')
const isRedirectLoading = ref(false)
const copied = ref(false)

const { getStoreLink, ensureAuth, hasNostrExtensionSupport } = useSatsbackApi()

async function handleOrderClick() {
  if (!isSatsback.value) {
    const url = resolveFallbackUrl()
    if (url)
      window.open(url, '_blank')
    return
  }
  // Mobile browsers can't install the Nostr extension required for the
  // satsback redirect (see hasNostrExtensionSupport for the matrix).
  // Skip the install/auth prompts and offer a no-cashback bypass so the
  // user can still get to the shop.
  if (!hasNostrExtensionSupport()) {
    noCashbackReason.value = 'mobile'
    isNoCashbackOpen.value = true
    return
  }
  // Resolve nostr auth before showing the "open shop" modal so users
  // without the extension / without an account get the install or
  // account-setup prompt up front, instead of clicking through a
  // modal that silently fails on the redirect step.
  try {
    await ensureAuth()
  }
  catch (err) {
    // If the install-extension confirm was dismissed (user doesn't want
    // to install), offer the same "continue without cashback" escape
    // hatch we show to mobile users. Other auth failures (declined
    // signing, server errors) already surfaced their own toasts.
    if (String(err).includes('Need window.nostr')) {
      noCashbackReason.value = 'no-extension'
      isNoCashbackOpen.value = true
    }
    return
  }
  isModalOpen.value = true
}

function continueWithoutCashback() {
  isNoCashbackOpen.value = false
  const url = resolveFallbackUrl()
  if (url)
    window.open(url, '_blank')
}

async function copyProductName() {
  await navigator.clipboard.writeText(props.product.name)
  copied.value = true
  setTimeout(() => copied.value = false, 2000)
}

const toast = useToast()
const { t } = useI18n()

async function openStore() {
  if (!shopDomain.value?.store_id) return
  isRedirectLoading.value = true
  try {
    const url = await getStoreLink(shopDomain.value.store_id)
    if (url) {
      window.open(url, '_blank')
      isModalOpen.value = false
    }
    else {
      // ensureAuth succeeded but no redirect URL came back — treat as failure.
      openWithoutCashbackFallback()
    }
  }
  catch (err) {
    // Most common cause: Satsback's `/store/visit/...` 404s because the
    // store_id is stale or the shop is no longer in their catalog. Don't
    // leave the user staring at a frozen modal — toast it and fall back
    // to opening the product URL directly.
    console.warn('[satsback] getStoreLink failed', err)
    openWithoutCashbackFallback()
  }
  finally {
    isRedirectLoading.value = false
  }
}

function resolveFallbackUrl(): string | null {
  // Prefer the exact product page from the Algolia record…
  if (props.product.sourceUrl)
    return props.product.sourceUrl
  // …else search for the product name on the shop using the same
  // `searchUrl` template the crawl pipeline uses (literal "ipad"
  // placeholder gets swapped for the URL-encoded product name)…
  const template = shopDomain.value?.crawl?.searchUrl
  if (template && props.product.name) {
    return template.replaceAll('ipad', encodeURIComponent(props.product.name))
  }
  // …else just dump them on the shop homepage.
  return shopDomain.value?.url ?? null
}

function openWithoutCashbackFallback() {
  toast.add({
    title: t('product.cashbackUnavailable.title'),
    description: t('product.cashbackUnavailable.description'),
    color: 'warning',
    icon: 'i-lucide-triangle-alert',
  })
  const url = resolveFallbackUrl()
  if (url)
    window.open(url, '_blank')
  isModalOpen.value = false
}
</script>

<!-- A card component to display product information with image, price, and discounts -->
<template>
  <UCard class="product-card flex flex-col" variant="subtle" :ui="{ body: 'flex-grow flex flex-col' }">
    <template #header>
      <div class="flex justify-between items-center">
        <span class="font-semibold dark:text-neutral">{{ product.brand }}</span>

        <img
          v-if="shopDomain"
          :src="shopDomain.image"
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
        <span class="text-lg font-bold dark:text-neutral">{{ product.price }}</span>

        <!-- Bitcoin Discount Badge -->
        <UBadge
          v-if="product.group === 'payWithBitcoin'"
          color="warning"
          class="ml-2"
        >
          <UIcon name="i-lucide-bitcoin" class="size-6" />
          {{ $t('product.btcDiscount', { value: shopDomain?.discountValue }) }}
        </UBadge>

        <!-- Satsback Badge -->
        <UBadge
          v-else-if="shopDomain?.text"
          color="secondary"
          class="ml-2"
        >
          <UIcon name="i-custom-satsback" class="size-6" />
          <span class="dark:text-white">{{ shopDomain.text }}</span>
        </UBadge>
      </div>
      <p v-if="product.description" class="text-sm text-gray-400">
        {{ product.description }}
      </p>
    </div>

    <!-- Details Link -->
    <template #footer>
      <UButton
        class="cursor-pointer"
        color="primary"
        variant="soft"
        icon="i-lucide-shopping-cart"
        block
        @click="handleOrderClick"
      >
        {{ $t('product.order') }}
        <template #trailing>
          <UIcon name="i-lucide-arrow-right" class="size-5" />
        </template>
      </UButton>
    </template>
  </UCard>

  <UModal v-model:open="isModalOpen">
    <template #content>
      <div class="p-6 space-y-4">
        <h3 class="text-lg font-semibold">
          Search for this product on {{ shopDomain?.name }}
        </h3>
        <p class="text-sm text-gray-500">
          Copy the product name, then open the store and search for it to earn Satsback.
        </p>

        <div class="flex items-center gap-2 rounded-md border px-3 py-2 bg-gray-50 dark:bg-gray-900">
          <span class="flex-grow text-sm font-medium truncate">{{ product.name }}</span>
          <UButton
            size="xs"
            variant="ghost"
            :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
            :color="copied ? 'success' : 'neutral'"
            @click="copyProductName"
          />
        </div>

        <UButton
          block
          color="primary"
          :loading="isRedirectLoading"
          loading-icon="i-lucide-loader"
          icon="i-lucide-shopping-cart"
          @click="openStore"
        >
          Open {{ shopDomain?.name }}
          <template #trailing>
            <UIcon name="i-lucide-arrow-right" class="size-5" />
          </template>
        </UButton>
      </div>
    </template>
  </UModal>

  <!-- No-cashback escape hatch: shown either to mobile users (no extension
       possible) or to desktop users who dismissed the install-extension
       confirm without installing. -->
  <UModal v-model:open="isNoCashbackOpen">
    <template #content>
      <div class="p-6 space-y-4">
        <h3 class="text-lg font-semibold">
          {{ $t('product.noCashback.title') }}
        </h3>
        <p class="text-sm text-gray-500">
          {{ $t(noCashbackReason === 'mobile' ? 'product.noCashback.mobileReason' : 'product.noCashback.noExtensionReason') }}
        </p>
        <UButton
          block
          color="primary"
          icon="i-lucide-external-link"
          @click="continueWithoutCashback"
        >
          {{ $t('product.noCashback.continue') }}
          <template #trailing>
            <UIcon name="i-lucide-arrow-right" class="size-5" />
          </template>
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.product-card {
  transition: transform 0.2s ease-in-out;
}

.product-card:hover {
  transform: translateY(-4px);
}
</style>
