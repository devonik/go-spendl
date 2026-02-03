<script lang="ts" setup>
defineEmits<{
  change: [value: string]
}>()

const { t } = useI18n()

const model = ref()

const { data, pending } = useLazyFetch<string[]>(`/api/categories`)
const translatedList = computed(() => data.value?.map((item) => {
  return {
    value: item,
    label: t(item),
  }
}))
</script>

<template>
  <USelectMenu
    v-model="model"
    :items="translatedList"
    clear
    :placeholder="$t('search.filter.categories')"
    :loading="pending"
    class="w-48"
    @update:model-value="item => $emit('change', item?.value)"
  />
</template>
