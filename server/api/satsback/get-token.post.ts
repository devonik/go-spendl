import type { GetTokenResponse } from '~~/types/satsback'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const reponse = await $fetch<GetTokenResponse>(`https://satsback.com/api/v2/partner/auth/nostr/token`, { method: 'post', body: { event: body } })
  return { userId: reponse.user, token: reponse.token }
})
