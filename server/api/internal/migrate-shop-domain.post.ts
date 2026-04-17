import { getClient } from '~~/server/lib/algolia'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  const secret = getHeader(event, 'x-internal-secret')
  if (secret !== config.crawlWebhookSecret) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const client = getClient(config)

  const toUpdate: { objectID: string, shopDomain: string }[] = []

  await client.browseObjects<{ objectID: string, shopDomain: string }>({
    indexName: config.public.algoliaProductIndex,
    aggregator: (response) => {
      for (const hit of response.hits) {
        if (hit.shopDomain?.includes('.')) {
          toUpdate.push({
            objectID: hit.objectID,
            shopDomain: hit.shopDomain.split('.')[0],
          })
        }
      }
    },
  })

  if (toUpdate.length === 0) {
    return { updated: 0, message: 'All records already up to date.' }
  }

  await client.partialUpdateObjects({
    indexName: config.public.algoliaProductIndex,
    objects: toUpdate,
    createIfNotExists: false,
  })

  return { updated: toUpdate.length, message: `Updated shopDomain on ${toUpdate.length} records.` }
})
