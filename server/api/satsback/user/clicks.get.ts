import type { UserClickHistoryItem } from '~~/types/satsback'

/**
 * Retrieves the user's click history.
 */
export default defineEventHandler(async (event) => {
  const reponse = await $fetch<{ data: UserClickHistoryItem[] }>(`https://satsback.com/api/v2/user/clicks`, {
    headers: {
      Authorization: `Bearer ${event.context.authToken}`,
    },
  })
  console.info('Satsback User History Clicks', reponse)
  return reponse
})
