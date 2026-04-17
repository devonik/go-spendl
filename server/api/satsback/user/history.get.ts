import type { UserHistoryItem } from '~~/types/satsback'

export default defineEventHandler(async (event) => {
  return await $fetch<{ data: UserHistoryItem[] }>(`https://satsback.com/api/v2/user/history`, {
    headers: {
      Authorization: `Bearer ${event.context.authToken}`,
    },
  })
})
