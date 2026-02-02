import type { CreateUserResponse, GetTokenResponse } from '~~/types/satsback'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'
import { SimplePool } from 'nostr-tools/pool'
import { finalizeEvent, generateSecretKey, getPublicKey, verifyEvent } from 'nostr-tools/pure'

const SATSBACK_NOSTR_GET_TOKEN_KIND = 27237
const SATSBACK_NOSTR_CREATE_USER_KIND = 27236

export async function handleSatsbackNostrAuth(signedEventGetToken, signedEventCreate): Promise<{ userId: string, token?: string } | undefined> {
  try {
    const getTokenResp = await $fetch<GetTokenResponse>(`https://satsback.com/api/v2/partner/auth/nostr/token`, { method: 'post', body: { event: signedEventGetToken } })
    return { userId: getTokenResp.user, token: getTokenResp.token }
  }
  catch (error) {
    if (error.statusCode) {
      console.warn('Statsback Auth: GetToken reponded with 404. Will create satsback account')
      try {
        const createUserResp = await $fetch<CreateUserResponse>(`https://satsback.com/api/v2/partner/auth/nostr`, { method: 'post', body: { event: signedEventCreate } })

        return { userId: createUserResp.user_id }
      }
      catch (error) {
        console.warn('Statsback Auth: CreateUser error', error)
      }
    }
  }
}
export default defineEventHandler(async () => {
  /* const storage = useStorage()
  const skHex = await storage.getItem('skHex')
  let skBytes = skHex ? hexToBytes(skHex) : null
  if (!skHex) {
    skBytes = generateSecretKey()
    console.log('Generated new secret key')
    await storage.setItem('skHex', bytesToHex(skBytes))
    console.log('storage hey key', await storage.getItem('skHex'))
  }
  else {
    console.log('Using existing secret key')
  }
  console.log('skHex', skHex) */
  // let pk = getPublicKey(sk) // `pk` is a hex string

  const sk = hexToBytes(testHex)
  /* let event = finalizeEvent({
    kind: SATSBACK_NOSTR_CREATE_USER_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['partner', 'gospendl'], ['country', 'de'], ['payout_address', 'rollingcoin@blink.sv']],
    content: 'create',
  }, sk) */

  let event = finalizeEvent({
    kind: SATSBACK_NOSTR_GET_TOKEN_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['partner', 'gospendl'], ['country', 'de']],
    content: 'get-token',
  }, sk)

  let isGood = verifyEvent(event)

  /* const pool = new SimplePool()

  const test = await pool.publish(['https://satsback.com/api/v2/partner/auth/nostr'], event)
  test.forEach((result) => {
    console.log('Satsback Nostr user creation publish result', result)
    result.then((res) => {
      console.log('Satsback Nostr user creation publish success', res)
    }).catch((err) => {
      console.log('Satsback Nostr user creation publish error', err)
    })
  }) */
  try {
    const result = await $fetch('https://satsback.com/api/v2/partner/auth/nostr/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: { event },
    })
    console.log('Satsback Nostr user creation publish success', result)
  }
  catch (err) {
    console.error('Error publishing to Satsback:', err)
  }
  return { event, isGood }
})
