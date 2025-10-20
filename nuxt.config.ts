// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  runtimeConfig: {
    algoliaAppId: process.env.ALGOLIA_APP_ID,
    algoliaApiKey: process.env.ALGOLIA_API_KEY,
  },
  modules: [
    '@nuxt/eslint',
    '@nuxt/image',
    '@nuxt/test-utils',
    '@nuxt/ui',
    '@nuxtjs/i18n',
    '@nuxt/fonts',
  ],
  css: ['~/assets/css/main.css'],
  icon: {
    customCollections: [{
      prefix: 'custom',
      dir: './app/assets/icons',
    }],
  },
  i18n: {
    locales: [
      { code: 'en', language: 'en-US', name: 'English', file: 'en.ts' },
      { code: 'de', language: 'de-DE', name: 'Deutsch', file: 'de.ts' },
      {
        code: 'es',
        file: 'es.ts',
      },
    ],
    defaultLocale: 'de',
    skipSettingLocaleOnNavigate: true,
    baseUrl: 'https://gospendl.com',
  },
})
