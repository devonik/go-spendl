import type { UserPayoutItem } from '~~/types/satsback'

export default defineEventHandler(async (event) => {
  return await $fetch<{ data: UserPayoutItem[] }>(`https://satsback.com/api/v2/user/payouts`, {
    headers: {
      Authorization: `Bearer ${event.context.authToken}`,
    },
  })
})
