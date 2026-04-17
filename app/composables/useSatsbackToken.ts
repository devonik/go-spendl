export function useSatsbackToken() {
  return useCookie<string | null>('satsback_token', { maxAge: 60 * 60 })
}
