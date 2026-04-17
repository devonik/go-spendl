import type { Store } from '~~/types/types'

export function useStores(country = 'germany') {
  return useFetch<Store[]>(`/api/stores`, {
    query: { country },
    key: `stores-${country}`,
  })
}
