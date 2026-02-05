import { cachedStores } from '~~/server/utils/stores'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  if (query.country && typeof query.country !== 'string') {
    throw new Error('country must be a string')
  }
  const stores = await cachedStores(query.country as string).catch(() => 0)

  return stores
})
