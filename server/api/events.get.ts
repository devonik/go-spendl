import { Redis } from 'ioredis'
import { CRAWL_EVENTS_CHANNEL } from '~~/server/lib/crawl-events-channel'

// SSE bridge from Redis pub/sub to the browser. Each connection opens its
// own ioredis subscriber because ioredis flips a connection into
// subscribe-only mode once SUBSCRIBE is issued — sharing one across peers
// would serialize their messages incorrectly. The connection closes when
// the client disconnects or the Vercel Function hits its max duration;
// the EventSource client auto-reconnects.
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  if (!config.redisUrl) {
    throw createError({ statusCode: 503, statusMessage: 'Realtime channel not configured' })
  }

  const res = event.node.res
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.flushHeaders?.()
  // Initial comment flushes the headers to the client — writeHead + flushHeaders
  // alone is not enough for the response to reach the socket in some Nitro/h3
  // dev configurations. Also serves as the "SSE opened" signal for EventSource.
  res.write(': connected\n\n')

  const subscriber = new Redis(config.redisUrl, {
    maxRetriesPerRequest: null,
    lazyConnect: false,
  })

  subscriber.on('message', (_channel, message) => {
    res.write(`data: ${message.replace(/\n/g, '\\n')}\n\n`)
  })
  subscriber.on('error', (err) => {
    console.error('[events] redis subscriber error', err)
  })

  // Subscribe in the background so we don't block on Upstash's cold TLS
  // handshake before the client gets the SSE headers.
  subscriber.subscribe(CRAWL_EVENTS_CHANNEL).catch((err) => {
    console.error('[events] subscribe failed', err)
    res.end()
  })

  // Anti-idle heartbeat so intermediate proxies keep the connection open.
  const heartbeat = setInterval(() => {
    res.write(': ping\n\n')
  }, 15000)

  let cleanedUp = false
  let maxDurationTimer: NodeJS.Timeout | null = null
  const cleanup = () => {
    if (cleanedUp)
      return
    cleanedUp = true
    clearInterval(heartbeat)
    if (maxDurationTimer)
      clearTimeout(maxDurationTimer)
    subscriber.disconnect()
  }

  // Force our own teardown before Vercel's max-duration (300s) kills the
  // function. Otherwise the ioredis TCP connection lingers as a zombie
  // subscriber at Upstash and future publishes are delivered into a dead
  // response, so the browser sees nothing. EventSource auto-reconnects.
  maxDurationTimer = setTimeout(() => {
    cleanup()
    try {
      res.end()
    }
    catch {
      // Response may already be closed by the platform.
    }
  }, 250_000)

  // On Vercel, response 'close' fires reliably when the platform tears the
  // connection down; the request-side events don't always. Listen on both.
  event.node.res.on('close', cleanup)
  event.node.req.on('close', cleanup)
  event.node.req.on('end', cleanup)

  // We manage the response lifecycle manually; keep the promise pending so
  // h3 doesn't try to finalize the response until the client disconnects.
  event._handled = true
  return new Promise<void>(() => {})
})
