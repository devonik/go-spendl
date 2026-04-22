export function useSatsbackToken() {
  const cookie = useCookie<string | null>('satsback_token', { maxAge: 60 * 60 })
  const state = useState<string | null>('satsback_token', () => cookie.value ?? null)

  watch(state, val => cookie.value = val)

  return state
}
