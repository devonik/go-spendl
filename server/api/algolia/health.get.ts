export default defineEventHandler(async () => {
  return $fetch('https://status.algolia.com/1/status')
})
