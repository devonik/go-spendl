import type { UserClickHistoryItem } from '~~/types/satsback'

export default defineEventHandler(async (event) => {
  try {
    return await $fetch<{ data: UserClickHistoryItem[] }>(`https://satsback.com/api/v2/user/clicks`, {
      headers: { Authorization: `Bearer ${event.context.authToken}` },
    })
  }
  catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500
    throw createError({ statusCode: status })
  }
})
