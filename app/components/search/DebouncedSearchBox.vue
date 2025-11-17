<script>
import { connectSearchBox } from 'instantsearch.js/es/connectors'
import { createWidgetMixin } from 'vue-instantsearch/vue3/es'

export default {
  mixins: [createWidgetMixin({ connector: connectSearchBox })],
  props: {
    delay: {
      type: Number,
      default: 300,
      required: false,
    },
    modelValue: {
      type: String,
      default: '',
      required: false,
    },
  },
  emits: ['update:modelValue'],
  data() {
    return {
      timerId: null,
      localQuery: this.modelValue,
    }
  },
  computed: {
    query: {
      get() {
        return this.localQuery
      },
      set(val) {
        this.localQuery = val
        if (this.timerId) {
          clearTimeout(this.timerId)
        }
        this.timerId = setTimeout(() => {
          this.state.refine(this.localQuery)
          this.$emit('update:modelValue', this.localQuery)
        }, this.delay)
      },
    },
  },
  unmounted() {
    if (this.timerId) {
      clearTimeout(this.timerId)
    }
  },
}
</script>

<template>
  <input v-model="query" type="search" class="ais-SearchBox-input w-full">
  <UInput
    v-model="query"
  >
    <template #trailing>
      <span :hidden="state && state.isSearchStalled === false" class="mr-3">{{ $t('search.loading') }}</span>
      <UIcon name="i-lucide-search" />
    </template>
  </UInput>
</template>
