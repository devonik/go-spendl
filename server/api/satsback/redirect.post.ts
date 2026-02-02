import type { GetTokenResponse, VisitStoreResponse } from '~~/types/satsback'
import { handleSatsbackNostrAuth } from '../../lib/satsback'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  console.log('sended body', body)
  // TODO get user id by calling get token ?
  if (!body.storeId) {
    throw new Error('storeId is required')
  }
  if (!body.userId && (!body.signedEventGetToken && body.signedEventCreate)) {
    throw new Error('userId or (signedEventGetToken and signedEventCreate) is required')
  }
  try {
    if (!body.userId) {
      const { token, userId } = await handleSatsbackNostrAuth(body.signedEventGetToken, body.signedEventCreate)

      body.userId = userId
    }
    console.log('going to generate store link', body.storeId, body.userId)
    return await $fetch<VisitStoreResponse>(`https://satsback.com/api/v2/store/visit/${body.storeId}/${body.userId}`)
  }
  catch (e) {
    console.error('Redirect visit failed', e)
    throw new Error('Failed to redirect visit')
  }
})
