<script lang="ts" setup>
import type { ConfirmDialogOptions } from '@/composables/useConfirmDialog'

const props = withDefaults(defineProps<ConfirmDialogOptions>(), {
  body: true,
})

const emits = defineEmits<{
  close: [value: boolean]
}>()

const email = ref<string>()

function handleConfirm() {
  if (props.setEmail)
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
    <template v-if="body" #body>
      <div class="flex flex-col gap-3">
        <UInput v-if="props.setEmail" v-model="email" trailing-icon="i-lucide-at-sign" placeholder="Enter your email" class="w-full" />
        <template v-if="linkGroups && Object.keys(linkGroups).length === 1">
          <div class="flex flex-wrap gap-3">
            <UButton v-for="link in linkGroups[0]" v-bind="link" :key="link.label" />
          </div>
        </template>
        <template v-else-if="linkGroups">
          <div v-for="(links, groupIndex) in linkGroups" :key="groupIndex" class="mb-3">
            <div class="text-highlighted font-semibold mb-1">
              {{ groupIndex }}
            </div>
            <div class="flex flex-wrap gap-3">
              <UButton v-for="link in links" v-bind="link" :key="link.label" />
            </div>
          </div>
        </template>
      </div>
    </template>
    <template #footer>
      <UButton label="Cancel" color="neutral" variant="outline" @click="emits('close', false)" />
      <UButton label="Confirm" color="neutral" @click="handleConfirm" />
    </template>
  </UModal>
</template>
