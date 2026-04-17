export default defineNuxtPlugin(() => {
  const token = useSatsbackToken()

  return {
    provide: {
      satsbackFetch: $fetch.create({
        onRequest({ options }) {
          if (token.value) {
            options.headers = {
              ...options.headers,
              Authorization: `Bearer ${token.value}`,
            }
          }
        },
        onResponseError({ response }) {
          if (response.status === 401) {
            token.value = null
          }
        },
      }),
    },
  }
})
