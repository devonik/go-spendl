// Environment-scoped Redis pub/sub channel for crawl notifications.
// Isolates local dev from Vercel preview/production so a locally-triggered
// crawl doesn't broadcast to real users, and vice versa. VERCEL_ENV is
// automatically set on Vercel Functions ('production' | 'preview' |
// 'development'); locally we fall back to 'development'.
export const CRAWL_EVENTS_CHANNEL = `crawl:events:${process.env.VERCEL_ENV || 'development'}`
