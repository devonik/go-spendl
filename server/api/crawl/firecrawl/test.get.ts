export default defineEventHandler(async (event) => {
  const host = 'api.scrapeless.com'
  const url = `https://${host}/api/v1/unlocker/request`
  const token = 'sk_03Pmsk9n9GPdFpIFTx0myzGA211kCSlwXEoZXauYZuf2MWgOxm78gFDxEKKJiitw'
  const jsonPayload = `{
    "actor": "unlocker.webunlocker",
    "proxy": {
        "country": "ANY"
    },
    "input": {
        "url": "https://www.scrapeless.com",
        "method": "GET",
        "redirect": false,
        "jsRender": {"enabled":false,"headless":true,"waitUntil":"domcontentloaded","instructions":[],"block":{"resources":[],"urls":[]},"response":{"type":"html","options":{"selector":""}}}
    }
}`

  const response = $fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-token': token,
    },
    body: jsonPayload,
  })

  return response
})
