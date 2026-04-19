import type { UserHistoryItem } from '~~/types/satsback'

export default defineEventHandler(async (event) => {
  try {
    return await $fetch<{ data: UserHistoryItem[] }>(`https://satsback.com/api/v2/user/history`, {
      headers: { Authorization: `Bearer ${event.context.authToken}` },
    })
  }
  catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500
    throw createError({ statusCode: status })
  }
})
