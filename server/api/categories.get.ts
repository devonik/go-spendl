import { CATEGORY_RULES } from '~~/server/lib/store-category-matcher'

export default defineEventHandler(async (event) => {
  return CATEGORY_RULES.map((rule) => {
    return rule.category
  })
})
