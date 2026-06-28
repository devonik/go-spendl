import type { GetTokenResponse } from '~~/types/satsback'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  try {
    const response = await $fetch<GetTokenResponse>(`https://satsback.com/api/v2/partner/auth/nostr/token`, { method: 'post', body: { event: body } })
    // Satsback's `/store/visit/{storeId}/{userId}` wants the short
    // `satsback_user_id` (same format as store_id), NOT the Nostr `user`
    // pubkey. Sending the pubkey 404s.
    return { userId: response.satsback_user_id, token: response.token }
  }
  catch (error) {
    if (error.statusCode === 404) {
      console.log('catched error 404', error.statusCode)
      return createError({
        statusCode: 404,
        statusMessage: 'Not found',
        message: 'Not found - May the user does not exist yet',
      })
    }
    throw error
  }
})
