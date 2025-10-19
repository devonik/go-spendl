export default defineEventHandler(async (event) => {
  return $fetch('https://status.algolia.com/1/status')
})
