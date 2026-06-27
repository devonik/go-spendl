import type { VisitStoreResponse } from '~~/types/satsback'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  if (!body.storeId || !body.userId) {
    throw createError({ statusCode: 400, statusMessage: 'storeId and userId are required' })
  }
  try {
    return await $fetch<VisitStoreResponse>(`https://satsback.com/api/v2/store/visit/${body.storeId}/${body.userId}`)
  }
  catch (err) {
    // Most common failure here: 404 because the store_id is stale (shop
    // removed from the Satsback catalog). Surface the upstream status so
    // the client can branch on it (e.g. fall back to a direct shop open).
    const statusCode = (err as { statusCode?: number, status?: number }).statusCode
      ?? (err as { status?: number }).status
      ?? 502
    const statusMessage = (err as { statusMessage?: string }).statusMessage
      ?? (err as { message?: string }).message
      ?? 'Upstream satsback request failed'
    console.warn(`[satsback/redirect] upstream ${statusCode} for store ${body.storeId} / user ${body.userId}: ${statusMessage}`)
    throw createError({ statusCode, statusMessage })
  }
})
