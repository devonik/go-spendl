import type { UserPayoutItem } from '~~/types/satsback'

export default defineEventHandler(async (event) => {
  try {
    return await $fetch<{ data: UserPayoutItem[] }>(`https://satsback.com/api/v2/user/payouts`, {
      headers: { Authorization: `Bearer ${event.context.authToken}` },
    })
  }
  catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500
    throw createError({ statusCode: status })
  }
})
