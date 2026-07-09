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
    cronSecret: process.env.CRON_SECRET,
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
    '@vueuse/nuxt',
    '@nuxtjs/seo',
  ],
  css: ['~/assets/css/main.css'],
  site: {
    url: 'https://gospendl.com',
    name: 'GoSpendl',
    description: 'Die Preisvergleichs-App rund um Bitcoin. Finde Onlineshops, in denen du direkt mit Bitcoin bezahlst oder Satsback-Cashback in Bitcoin erhältst.',
    defaultLocale: 'de',
    // twitter: '@gospendl',
  },
  sitemap: {
    exclude: [
      '/search',
      '/en/search',
      '/internal/**',
      '/en/internal/**',
    ],
  },
  robots: {
    disallow: ['/internal/'],
  },
  routeRules: {
    '/search': { robots: 'noindex, follow' },
    '/en/search': { robots: 'noindex, follow' },
    '/internal/**': { robots: 'noindex, nofollow' },
    '/en/internal/**': { robots: 'noindex, nofollow' },
  },
  schemaOrg: {
    identity: {
      type: 'Organization',
      name: 'GoSpendl',
      url: 'https://gospendl.com',
      logo: 'https://gospendl.com/logo-light.png',
      email: 'info@gospendl.com',
    },
  },
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
  nitro: {
    experimental: {
      websocket: true,
    },
  },
})
