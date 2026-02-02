<script lang="ts" setup>
import type { FormSubmitEvent } from '@nuxt/ui'
import * as z from 'zod'

interface ConfirmDialogProps {
  title?: string
  description?: string
  setEmail: (value?: string) => void
}

const props = defineProps<ConfirmDialogProps>()

const emits = defineEmits<{
  close: [value: boolean]
}>()

const email = ref<string>()

function handleConfirm() {
  props.setEmail(email.value)
  emits('close', true)
}
</script>

<template>
  <UModal
    :title="title"
    :description="description"
    :dismissible="false"
    :ui="{ footer: 'justify-end' }"
  >
    <template #body>
      <UInput v-model="email" trailing-icon="i-lucide-at-sign" placeholder="Enter your email" class="w-full" />
    </template>
    <template #footer>
      <UButton label="Cancel" color="neutral" variant="outline" @click="emits('close', false)" />
      <UButton label="Confirm" color="neutral" @click="handleConfirm" />
    </template>
  </UModal>
</template>
