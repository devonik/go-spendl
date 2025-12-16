// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  runtimeConfig: {
    algoliaSearchApiKey: process.env.ALGOLIA_SEARCH_API_KEY,
    algoliaWriteApiKey: process.env.ALGOLIA_WRITE_API_KEY,
    slackWebhookUrl: process.env.NUXT_SLACK_WEBHOOK_URL,
    public: {
      algoliaAppId: process.env.ALGOLIA_APP_ID,
      algoliaProductIndex: process.env.ALGOLIA_PRODUCT_INDEX,
    },
    crawl4AiUrl: process.env.CRAWL4AI_URL,
    crawlWebhookSecret: process.env.CRAWL_WEBHOOK_SECRET,
    isCrawlUploadAutomaticEnabled: process.env.CRAWL_UPLOAD_AUTOMATIC,
    baseUrl: process.env.BASE_URL,
    vercelBlobStorageWriteToken: process.env.BLOB_READ_WRITE_TOKEN,
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
    ],
    defaultLocale: 'de',
    skipSettingLocaleOnNavigate: true,
    baseUrl: 'https://gospendl.com',
  },
})
