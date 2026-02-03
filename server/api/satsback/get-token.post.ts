import type { GetTokenResponse } from '~~/types/satsback'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  try {
    const reponse = await $fetch<GetTokenResponse>(`https://satsback.com/api/v2/partner/auth/nostr/token`, { method: 'post', body: { event: body } })
    return { userId: reponse.user, token: reponse.token }
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
