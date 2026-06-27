import type { VisitStoreResponse } from '~~/types/satsback'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  if (!body.storeId || !body.userId) {
    throw createError({ statusCode: 400, statusMessage: 'storeId and userId are required' })
  }
  // Same auth pattern as server/api/satsback/user/*. The token is set in
  // server/middleware/auth.ts from the incoming Authorization header.
  // Without it, Satsback returns 404 on `/store/visit/...` — likely an
  // intentional "don't leak existence to unauthenticated callers" behavior.
  if (!event.context.authToken) {
    throw createError({ statusCode: 401, statusMessage: 'Missing Authorization header on the request to /api/satsback/redirect' })
  }
  try {
    return await $fetch<VisitStoreResponse>(`https://satsback.com/api/v2/store/visit/${body.storeId}/${body.userId}`, {
      headers: { Authorization: `Bearer ${event.context.authToken}` },
    })
  }
  catch (err) {
    const statusCode = (err as { statusCode?: number, status?: number }).statusCode
      ?? (err as { status?: number }).status
      ?? 502
    const statusMessage = (err as { statusMessage?: string }).statusMessage
      ?? (err as { message?: string }).message
      ?? 'Upstream satsback request failed'
    // Capture the upstream response body so we can tell *why* it failed
    // (e.g. "store inactive" vs "user not found") instead of guessing
    // from the bare status code.
    const data = (err as { data?: unknown }).data
    console.warn(
      `[satsback/redirect] upstream ${statusCode} for store ${body.storeId} / user ${body.userId}: ${statusMessage}`,
      data !== undefined ? { upstreamBody: data } : '',
    )
    throw createError({ statusCode, statusMessage })
  }
})
