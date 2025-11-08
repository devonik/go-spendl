import type { NitroRuntimeConfig } from 'nitropack/types'
import type { AlgoliaProduct } from '~~/types/algolia'
import { algoliasearch } from 'algoliasearch'

export function getClient(config: NitroRuntimeConfig) {
  return algoliasearch(config.public.algoliaAppId, config.algoliaWriteApiKey)
}
export async function upsetAlgoliaObjects(crawlResults: AlgoliaProduct[], config: NitroRuntimeConfig) {
  console.info(`upsetAlgoliaObjects - START`)
  const client = getClient(config)

  // If there were 0 items found in algolia for this query upload all of them
  const upsetResponse = await client.partialUpdateObjects(
    {
      indexName: config.public.algoliaProductIndex,
      objects: crawlResults,
      createIfNotExists: true,
    },

  )
  console.info(`upsetAlgoliaObjects - uploaded all [${crawlResults.length}] crawled items to algolia`, upsetResponse)
  return upsetResponse
}
