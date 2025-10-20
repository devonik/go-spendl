import { algoliasearch } from 'algoliasearch'

export default defineEventHandler(async () => {
  const config = useRuntimeConfig()
  const client = algoliasearch(config.algoliaAppId, config.algoliaApiKey)
  return client.generateSecuredApiKey({
    parentApiKey: config.algoliaApiKey,
    restrictions: { validUntil: 2524604400, restrictIndices: ['prod_products'] },
  })
})
