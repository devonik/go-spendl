import type { CreateUserResponse } from '~~/types/satsback'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const reponse = await $fetch<CreateUserResponse>(`https://satsback.com/api/v2/partner/auth/nostr`, { method: 'post', body: { event: body } })
  console.info('Satsback Auth: New user created')
  return { userId: reponse.satsback_user_id }
})
