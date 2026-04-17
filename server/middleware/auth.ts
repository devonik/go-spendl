export default defineEventHandler((event) => {
  const authHeader = getHeader(event, 'authorization')
  if (authHeader) {
    event.context.authToken = authHeader.replace('Bearer ', '')
  }
})
