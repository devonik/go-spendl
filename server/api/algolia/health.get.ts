import { peers } from '~~/server/routes/ws'

export default defineEventHandler(async () => {
  peers.forEach(peer => peer.send(`{"source": "crawl.newData", "meta": { "itemCount": ${100}, "initialQuery": "${'macbook'}" } }`))
  return $fetch('https://status.algolia.com/1/status')
})
