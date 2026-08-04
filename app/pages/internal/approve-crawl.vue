<script lang="ts" setup>
import type { FormErrorEvent, FormSubmitEvent } from '@nuxt/ui'

import * as z from 'zod'

const { query } = useRoute()
const toast = useToast()

// `z.looseObject` keeps webhook-set fields the reviewer doesn't edit
// (category, model, lastCrawledAt, …) so they survive the approve flow
// and land in Algolia. The default `z.object` silently strips them.
const productSchema = z.looseObject({
  name: z.string('Required'),
  productUrl: z.url('Must be a URL'),
  brand: z.string().optional(),
  description: z.string().optional(),
  price: z.string('Required'),
  imageSrc: z.url('Must be a URL'),
  imageSrcset: z.string('Required').optional(),
  imageAlt: z.string('Required'),
  shopDomain: z.string('Required'),
  group: z.string('Required'),
  colors: z.string().optional(),
  objectID: z.string('Required'),
})
const schema = z.array(productSchema)
type Schema = z.output<typeof schema>

interface RunShop {
  slug: string
  status: 'ok' | 'failed'
  mode: 'auto' | 'approval'
  itemCount: number
  error?: string
  initialQuery?: string
  items?: Schema
}

function onFormError(event: FormErrorEvent) {
  if (event?.errors?.[0]?.id) {
    const element = document.getElementById(event.errors[0].id)
    element?.focus()
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

// --- Legacy single-file flow (in-flight links from before the run-based refactor) ---

const legacyStatus = ref<'loading' | 'loaded' | 'declined' | 'approved' | 'empty'>()
const legacyModel = ref<Schema>()
const legacyInitialQuery = ref<string>()
const isLegacy = computed(() => !!query.fileUrl)

async function loadLegacy() {
  legacyStatus.value = 'loading'
  const data = await $fetch<{ initialQuery: string, items: Schema }>(query.fileUrl as string)
  legacyInitialQuery.value = data.initialQuery
  legacyModel.value = data.items
  legacyStatus.value = legacyModel.value?.length ? 'loaded' : 'empty'
}

async function onLegacySubmit(event: FormSubmitEvent<Schema>) {
  await $fetch('/api/crawl/approve', {
    method: 'POST',
    body: {
      fileUrl: query.fileUrl,
      initialQuery: legacyInitialQuery.value,
      productsToUpload: event.data,
    },
  })
  legacyStatus.value = 'approved'
  toast.add({ title: 'Approved', description: 'Data will be uploaded to algolia', color: 'success' })
}

function declineLegacy() {
  $fetch('/api/crawl/decline', { method: 'POST', body: { fileUrl: query.fileUrl } })
  legacyStatus.value = 'declined'
  toast.add({ title: 'Declined', description: 'Data will not be uploaded to algolia', color: 'success' })
}

// --- Run-based flow: 1 approval UI per run, per-shop and global approve/decline ---

const runStatus = ref<'loading' | 'loaded' | 'error'>()
const shops = ref<RunShop[]>([])
const shopStatus = reactive<Record<string, 'pending' | 'approved' | 'declined'>>({})

async function loadRun() {
  runStatus.value = 'loading'
  try {
    const data = await $fetch<{ runId: string, shops: RunShop[] }>(`/api/crawl/runs/${query.runId}`)
    shops.value = data.shops
    data.shops.forEach((shop) => {
      shopStatus[shop.slug] = 'pending'
    })
    runStatus.value = 'loaded'
  }
  catch (err) {
    console.error(err)
    runStatus.value = 'error'
  }
}

const accordionItems = computed(() => shops.value.map(shop => ({
  slug: shop.slug,
  slot: shop.slug,
  label: shop.status === 'failed'
    ? `${shop.slug} — failed`
    : `${shop.slug} — ${shop.itemCount} product${shop.itemCount === 1 ? '' : 's'}${shopStatus[shop.slug] !== 'pending' ? ` (${shopStatus[shop.slug]})` : ''}`,
  icon: shop.status === 'failed' ? 'lucide:circle-alert' : 'lucide:store',
})))

const pendingApprovableShops = computed(() => shops.value.filter(
  s => s.status === 'ok' && s.mode === 'approval' && s.itemCount > 0 && shopStatus[s.slug] === 'pending',
))

async function approveShop(shop: RunShop, products: Schema) {
  await $fetch('/api/crawl/approve', {
    method: 'POST',
    body: {
      runId: query.runId,
      shops: [{ slug: shop.slug, initialQuery: shop.initialQuery, productsToUpload: products }],
    },
  })
  shopStatus[shop.slug] = 'approved'
  toast.add({ title: 'Approved', description: `${shop.slug} will be uploaded to algolia`, color: 'success' })
}

async function declineShop(shop: RunShop) {
  await $fetch('/api/crawl/decline', {
    method: 'POST',
    body: { runId: query.runId, slugs: [shop.slug] },
  })
  shopStatus[shop.slug] = 'declined'
  toast.add({ title: 'Declined', description: `${shop.slug} will not be uploaded`, color: 'success' })
}

async function approveAll() {
  const targets = pendingApprovableShops.value
  if (!targets.length)
    return
  await $fetch('/api/crawl/approve', {
    method: 'POST',
    body: {
      runId: query.runId,
      shops: targets.map(shop => ({ slug: shop.slug, initialQuery: shop.initialQuery, productsToUpload: shop.items })),
    },
  })
  targets.forEach((shop) => {
    shopStatus[shop.slug] = 'approved'
  })
  toast.add({ title: 'Approved all', description: `${targets.length} shop(s) will be uploaded to algolia`, color: 'success' })
}

async function declineAll() {
  const targets = pendingApprovableShops.value
  if (!targets.length)
    return
  await $fetch('/api/crawl/decline', {
    method: 'POST',
    body: { runId: query.runId, slugs: targets.map(s => s.slug) },
  })
  targets.forEach((shop) => {
    shopStatus[shop.slug] = 'declined'
  })
  toast.add({ title: 'Declined all', description: `${targets.length} shop(s) will not be uploaded`, color: 'success' })
}

onMounted(() => {
  if (query.fileUrl)
    loadLegacy()
  else if (query.runId)
    loadRun()
  else
    throw new Error('runId or fileUrl query param is required')
})
</script>

<template>
  <div class="p-6">
    <!-- Legacy per-shop approval (fileUrl query param) -->
    <div v-if="isLegacy">
      <div v-if="legacyStatus === 'loading' || !legacyStatus">
        <UProgress indeterminate />
      </div>
      <UForm v-else-if="legacyStatus === 'loaded'" :schema="schema" :validate-on="['change']" :state="legacyModel" @submit="onLegacySubmit" @error="onFormError">
        <div class="flex flex-wrap gap-6">
          <UCard v-for="(product, index) in legacyModel" :key="product.objectID" class="w-[350px]" :ui="{ body: 'flex flex-col gap-3' }" required>
            <UFormField label="Product name" :name="`${index}.name`" required>
              <UInput v-model="product.name" />
            </UFormField>
            <UFormField label="Product Url" :name="`${index}.productUrl`" hint="Link to the product. Used for order button" required>
              <UInput v-model="product.productUrl" />
            </UFormField>
            <UFormField label="Brand" :name="`${index}.brand`">
              <UInput v-model="product.brand" />
            </UFormField>
            <UFormField label="Description" :name="`${index}.description`">
              <UInput v-model="product.description" />
            </UFormField>
            <UFormField label="Product price" :name="`${index}.price`" hint="E.g. 17€" required>
              <UInput v-model="product.price" />
            </UFormField>
            <UFormField label="Image Src" :name="`${index}.imageSrc`" hint="E.g. https://test.com/image.png" required>
              <UInput v-model="product.imageSrc" />
            </UFormField>
            <UFormField label="Image Srcset" :name="`${index}.imageSrcset`" hint="Is used for optimizing image">
              <UInput v-model="product.imageSrcset" />
            </UFormField>
            <UFormField label="Image Alt" :name="`${index}.imageAlt`" hint="Text is shown if image cannot be loaded" required>
              <UInput v-model="product.imageAlt" />
            </UFormField>
            <UFormField label="Shop Domain" :name="`${index}.shopDomain`" hint="E.g. baur.de" required>
              <UInput v-model="product.shopDomain" />
            </UFormField>
            <UFormField label="Group" :name="`${index}.group`" hint="Must be satsback or payWithBitcoin" required>
              <USelect v-model="product.group" :items="['satsback', 'payWithBitcoin']" :ui="{ content: 'min-w-fit' }" />
            </UFormField>
            <UFormField label="Colors" :name="`${index}.colors`">
              <UInput v-model="product.colors" />
            </UFormField>
            <UFormField label="Object ID" :name="`${index}.objectID`" hint="Used as ID in algola. Better do not edit" required>
              <UInput v-model="product.objectID" disabled />
            </UFormField>
            <template #footer>
              <UButton label="Delete" icon="lucide:trash" color="error" @click="legacyModel.splice(index, 1)" />
            </template>
          </UCard>
        </div>

        <UCard class="mt-3" :ui="{ body: 'flex gap-3' }">
          <UButton color="primary" icon="lucide:send" type="submit">
            Approve
          </UButton>
          <UButton color="error" icon="lucide:trash" @click="declineLegacy">
            Decline
          </UButton>
        </UCard>
      </UForm>
      <div v-else-if="legacyStatus === 'approved'">
        <UBanner color="primary" icon="lucide-check" title="Crawl approved" />
      </div>
      <div v-else-if="legacyStatus === 'declined'">
        <UBanner color="error" icon="lucide-x" title="Crawl declined" />
      </div>
      <div v-else-if="legacyStatus === 'empty'">
        <UBanner color="error" icon="lucide-x" title="No data. May it's a old job" />
      </div>
    </div>

    <!-- Run-based approval (runId query param) -->
    <div v-else>
      <div v-if="runStatus === 'loading' || !runStatus">
        <UProgress indeterminate />
      </div>
      <div v-else-if="runStatus === 'error'">
        <UBanner color="error" icon="lucide-x" title="Could not load this run" />
      </div>
      <div v-else-if="shops.length === 0">
        <UBanner color="error" icon="lucide-x" title="No shops found for this run" />
      </div>
      <div v-else class="flex flex-col gap-4">
        <UCard :ui="{ body: 'flex items-center gap-3' }">
          <div class="font-semibold">
            Run {{ query.runId }}
          </div>
          <div class="ml-auto flex gap-2">
            <UButton color="primary" icon="lucide:check-check" :disabled="!pendingApprovableShops.length" @click="approveAll">
              Approve All ({{ pendingApprovableShops.length }})
            </UButton>
            <UButton color="error" icon="lucide:trash" :disabled="!pendingApprovableShops.length" @click="declineAll">
              Decline All
            </UButton>
          </div>
        </UCard>

        <UAccordion :items="accordionItems">
          <template v-for="shop in shops" :key="shop.slug" #[`${shop.slug}-body`]>
            <div v-if="shop.status === 'failed'" class="p-2">
              <UBanner color="error" icon="lucide-x" :title="`Crawl failed: ${shop.error || 'unknown error'}`" />
            </div>
            <div v-else-if="shop.mode === 'auto'" class="p-2 text-sm text-muted">
              Automatic upload was enabled — {{ shop.itemCount }} item(s) were already uploaded to Algolia.
            </div>
            <div v-else-if="!shop.items?.length" class="p-2 text-sm text-muted">
              No products extracted for this shop.
            </div>
            <UForm v-else :schema="schema" :validate-on="['change']" :state="shop.items" @submit="(event) => approveShop(shop, event.data)" @error="onFormError">
              <div class="flex flex-wrap gap-6">
                <UCard v-for="(product, index) in shop.items" :key="product.objectID" class="w-[350px]" :ui="{ body: 'flex flex-col gap-3' }" required>
                  <UFormField label="Product name" :name="`${index}.name`" required>
                    <UInput v-model="product.name" />
                  </UFormField>
                  <UFormField label="Product Url" :name="`${index}.productUrl`" hint="Link to the product. Used for order button" required>
                    <UInput v-model="product.productUrl" />
                  </UFormField>
                  <UFormField label="Brand" :name="`${index}.brand`">
                    <UInput v-model="product.brand" />
                  </UFormField>
                  <UFormField label="Description" :name="`${index}.description`">
                    <UInput v-model="product.description" />
                  </UFormField>
                  <UFormField label="Product price" :name="`${index}.price`" hint="E.g. 17€" required>
                    <UInput v-model="product.price" />
                  </UFormField>
                  <UFormField label="Image Src" :name="`${index}.imageSrc`" hint="E.g. https://test.com/image.png" required>
                    <UInput v-model="product.imageSrc" />
                  </UFormField>
                  <UFormField label="Image Srcset" :name="`${index}.imageSrcset`" hint="Is used for optimizing image">
                    <UInput v-model="product.imageSrcset" />
                  </UFormField>
                  <UFormField label="Image Alt" :name="`${index}.imageAlt`" hint="Text is shown if image cannot be loaded" required>
                    <UInput v-model="product.imageAlt" />
                  </UFormField>
                  <UFormField label="Shop Domain" :name="`${index}.shopDomain`" hint="E.g. baur.de" required>
                    <UInput v-model="product.shopDomain" />
                  </UFormField>
                  <UFormField label="Group" :name="`${index}.group`" hint="Must be satsback or payWithBitcoin" required>
                    <USelect v-model="product.group" :items="['satsback', 'payWithBitcoin']" :ui="{ content: 'min-w-fit' }" />
                  </UFormField>
                  <UFormField label="Colors" :name="`${index}.colors`">
                    <UInput v-model="product.colors" />
                  </UFormField>
                  <UFormField label="Object ID" :name="`${index}.objectID`" hint="Used as ID in algola. Better do not edit" required>
                    <UInput v-model="product.objectID" disabled />
                  </UFormField>
                  <template #footer>
                    <UButton label="Delete" icon="lucide:trash" color="error" @click="shop.items?.splice(index, 1)" />
                  </template>
                </UCard>
              </div>

              <UCard class="mt-3" :ui="{ body: 'flex items-center gap-3' }">
                <UButton color="primary" icon="lucide:send" type="submit" :disabled="shopStatus[shop.slug] !== 'pending'">
                  Approve {{ shop.slug }}
                </UButton>
                <UButton color="error" icon="lucide:trash" :disabled="shopStatus[shop.slug] !== 'pending'" @click="declineShop(shop)">
                  Decline {{ shop.slug }}
                </UButton>
                <UBadge v-if="shopStatus[shop.slug] !== 'pending'" :color="shopStatus[shop.slug] === 'approved' ? 'primary' : 'error'">
                  {{ shopStatus[shop.slug] }}
                </UBadge>
              </UCard>
            </UForm>
          </template>
        </UAccordion>
      </div>
    </div>
  </div>
</template>

<style scoped>

</style>
