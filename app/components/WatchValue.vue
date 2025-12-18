    <!-- WatchValue.vue -->
<script>
import { watch } from 'vue'

export default {
  props: {
    value: {
      required: true,
      type: undefined, // Allows any type
    },
    immediate: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['change'],
  setup(props, { emit }) {
    watch(
      () => props.value,
      (val) => {
        emit('change', val)
      },
      { immediate: props.immediate },
    )
  },
  render() {
    return [] // Renderless component, returns no markup
  },
}
</script>
