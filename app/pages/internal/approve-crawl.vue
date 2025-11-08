<script lang="ts" setup>
import type { FormError, FormErrorEvent, FormSubmitEvent } from '@nuxt/ui'

import type { AlgoliaProduct } from '~~/types/algolia'
import * as z from 'zod'

const { query } = useRoute()
const status = ref<'loading' | 'loaded' | 'declined' | 'approved' | 'empty'>()

const jsonContent = ref()
const schema = z.array(
  z.object({
    name: z.string('Required'),
    sourceUrl: z.url('Must be a URL'),
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
  }),
)

type Schema = z.output<typeof schema>

const toast = useToast()

const model = ref<Schema>()

onMounted(async () => {
  if (query.fileUrl) {
    status.value = 'loading'
    jsonContent.value = await $fetch(query.fileUrl as string)
    model.value = jsonContent.value
    status.value = model.value?.length ? 'loaded' : 'empty'
  }
  else {
    throw new Error('fileUrl is missing')
  }
})

async function onSubmit(event: FormSubmitEvent<Schema>) {
  await $fetch('/api/crawl/approve', {
    method: 'POST',
    body: {
      fileUrl: query.fileUrl,
      productsToUpload: event.data,
    },
  })
  status.value = 'approved'
  toast.add({ title: 'Approved', description: 'Data will be uploaded to algolia', color: 'success' })
}

async function onError(event: FormErrorEvent) {
  if (event?.errors?.[0]?.id) {
    const element = document.getElementById(event.errors[0].id)
    element?.focus()
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

function declineCrawl() {
  $fetch('/api/crawl/decline', {
    method: 'POST',
    body: {
      fileUrl: query.fileUrl,
    },
  })
  status.value = 'declined'
  toast.add({ title: 'Declined', description: 'Data will not be uploaded to algolia', color: 'success' })
}
</script>

<template>
  <div>
    <div v-if="status === 'loading' || !status">
      <UProgress indeterminate />
    </div>
    <UForm v-else-if="status === 'loaded'" :schema="schema" :validate-on="['change']" :state="model" @submit="onSubmit" @error="onError">
      <div class="flex flex-wrap gap-6">
        <UCard v-for="(product, index) in model" :key="product.objectID" class="w-[350px]" :ui="{ body: 'flex flex-col gap-3' }" required>
          <UFormField label="Product name" :name="`${index}.name`" required>
            <UInput v-model="product.name" />
          </UFormField>
          <UFormField label="Source Url" :name="`${index}.sourceUrl`" hint="Link to the product. Used for order button" required>
            <UInput v-model="product.sourceUrl" />
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
            <UButton label="Delete" icon="lucide:trash" color="error" @click="model.splice(index, 1)" />
          </template>
        </UCard>
      </div>

      <UCard class="mt-3" :ui="{ body: 'flex gap-3' }">
        <UButton color="primary" icon="lucide:send" type="submit">
          Approve
        </UButton>
        <UButton color="error" icon="lucide:trash" @click="declineCrawl">
          Decline
        </UButton>
      </UCard>
    </UForm>
    <div v-else-if="status === 'approved'">
      <UBanner color="primary" icon="lucide-check" title="Crawl approved" />
    </div>
    <div v-else-if="status === 'declined'">
      <UBanner color="error" icon="lucide-x" title="Crawl declined" />
    </div>
    <div v-else-if="status === 'empty'">
      <UBanner color="error" icon="lucide-x" title="No data. May it's a old job" />
    </div>
  </div>
</template>

<style scoped>

</style>
