export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  // TODO get user id by calling get token ?
  if (!body.storeId || !body.userId) {
    throw new Error('storeId and userId is required')
  }
  return await $fetch<VisitStoreResponse>(`https://satsback.com/api/v2/store/visit/${body.storeId}/${body.userId}`)
})
