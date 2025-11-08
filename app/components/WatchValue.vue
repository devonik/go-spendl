    <!-- WatchValue.vue -->
<script>
import { watch } from 'vue'

export default {
  props: {
    value: {
      required: true,
      type: undefined, // Allows any type
    },
  },
  emits: ['change'],
  setup(props, { emit }) {
    watch(
      () => props.value,
      (val) => {
        emit('change', val)
      },
    )
  },
  render() {
    return [] // Renderless component, returns no markup
  },
}
</script>
