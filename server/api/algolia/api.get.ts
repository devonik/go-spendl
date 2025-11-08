import { getClient } from '~~/server/lib/algolia'

export default defineEventHandler(async () => {
  const config = useRuntimeConfig()
  const client = getClient(config)
  return client.generateSecuredApiKey({
    parentApiKey: config.algoliaSearchApiKey,
    restrictions: { validUntil: 2524604400, restrictIndices: [config.public.algoliaProductIndex, `${config.public.algoliaProductIndex}_price_asc`, `${config.public.algoliaProductIndex}_price_desc`] },
  })
})
