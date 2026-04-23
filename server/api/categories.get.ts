import categories from '~~/server/data/categories.json'

export default defineEventHandler(async () => {
  return categories.map(c => c.key)
})
