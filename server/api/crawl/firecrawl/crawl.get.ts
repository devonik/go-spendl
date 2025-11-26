import Firecrawl from '@mendable/firecrawl-js'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY })

  const schema1 = {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the Product e.g. Schwarze Jacke',
        },
        sourceUrl: {
          type: 'string',
          description: 'Detail URL of the product',
        },
        brand: {
          type: 'string',
          description: 'The brand of the product e.g. Garmin',
        },
        description: {
          type: 'string',
          description: 'Description of the product e.g. 45mm lang, diverse farben',
        },
        price: {
          type: 'string',
          description: 'Price of the product e.g. 15€',
        },
        imageUrl: {
          type: 'string',
          description: 'Image of the product',
        },
        shopDomain: {
          type: 'string',
          description: 'Add the shop domain e.g. baur.de',
        },
        group: {
          type: 'string',
          description: 'It is satsback',
        },
        colors: {
          type: 'string',
          description: 'Color options of the product. E.g. Braun, Schwarz',
        },
      },
    },

  }

  // Define schema to extract contents into
  const schema = z.object({
    products: z.array(
      z.object({
        name: z.string().describe('Name of the Product e.g. Schwarze Jacke'),
        sourceUrl: z.string().describe('Detail URL of the product'),
        brand: z.string().describe('The brand of the product e.g. Garmin'),
        features: z.string().describe('Features of the product e.g. 45mm lang, diverse farben'),
        price: z.string().describe('Price of the product e.g. 15€'),
        imageUrl: z.string().describe('Image of the product'),
        shopDomain: z.string().describe('Add the shop domain e.g. baur.de'),
        group: z.string().describe('It is satsback'),
        colors: z.string().describe('Color options of the product. E.g. Braun, Schwarz'),
      }),
    ),
  })
  console.log('schema', z.toJSONSchema(schema))

  const response = await firecrawl.scrape('https://www.baur.de/s/hose/', {
    formats: [
      { type: 'json', schema },
    ],
    // Get your results up to 500% faster when you don’t need the absolute freshest data. Control freshness via maxAge:
    // 604800000 = 1 week
    maxAge: 604800000,
  })

  console.log('scrape result', response)
  return response
})
