export function useSatsbackUserId() {
  return useCookie<string | null>('satsback_user_id', { maxAge: 60 * 60 * 24 * 30 })
}
