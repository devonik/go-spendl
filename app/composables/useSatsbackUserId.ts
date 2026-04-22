export function useSatsbackUserId() {
  const cookie = useCookie<string | null>('satsback_user_id', { maxAge: 60 * 60 * 24 * 30 })
  const state = useState<string | null>('satsback_user_id', () => cookie.value ?? null)

  watch(state, val => cookie.value = val)

  return state
}
