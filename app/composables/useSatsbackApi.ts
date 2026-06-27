import type { UserClickHistoryItem, UserHistoryItem, UserPayoutItem, VisitStoreResponse } from '~~/types/satsback'

const SATSBACK_NOSTR_GET_TOKEN_KIND = 27237
const SATSBACK_NOSTR_CREATE_USER_KIND = 27236

type NostrWindow = Window & { nostr?: { signEvent: (event: object) => Promise<object> } }

let authInProgress: Promise<void> | null = null

// Best-effort browser detection used to promote the matching install link
// in the missing-extension dialog. Chromium-family browsers (Edge, Brave,
// Opera, Vivaldi) all accept Chrome Web Store extensions, so they fall
// into the 'chrome' bucket. Returns null on SSR or unrecognised UAs — the
// dialog then shows both links with no promotion.
function detectBrowser(): 'chrome' | 'firefox' | null {
  if (typeof navigator === 'undefined')
    return null
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('firefox'))
    return 'firefox'
  if (ua.includes('chrome') || ua.includes('chromium'))
    return 'chrome'
  return null
}

// Whether the current browser can install a Nostr-signing extension at all.
// Mobile platforms mostly cannot:
// - iOS: Safari/Chrome/Firefox all forbid WebExtensions, so no Nostr signing.
// - Android Chrome / Brave / Edge mobile: no WebExtensions support.
// - Android Firefox: supports WebExtensions including nos2x-fox + Alby.
// - Kiwi Browser (Android, Chromium): supports Chrome extensions.
// Desktop browsers return true. Returns true on SSR so the caller can fall
// through to the regular extension-install flow (which detects missing nostr
// at runtime anyway).
function hasNostrExtensionSupport(): boolean {
  if (typeof navigator === 'undefined')
    return true
  const ua = navigator.userAgent.toLowerCase()
  const isMobile = /mobi|android|iphone|ipad|ipod/.test(ua)
  if (!isMobile)
    return true
  // Niche Android browsers that do support extensions.
  if (ua.includes('android') && ua.includes('firefox'))
    return true
  if (ua.includes('kiwi') || ua.includes('yandex'))
    return true
  return false
}

function buildExtensionLink(target: 'chrome' | 'firefox', href: string, current: 'chrome' | 'firefox' | null) {
  const isCurrent = current === target
  const labels = { chrome: 'Chrome', firefox: 'Firefox' }
  const icons = { chrome: 'i-custom-chrome', firefox: 'i-custom-firefox' }
  return {
    label: isCurrent ? `${labels[target]} · Current` : labels[target],
    icon: icons[target],
    variant: (isCurrent ? 'solid' : 'outline') as 'solid' | 'outline',
    color: (isCurrent ? 'primary' : undefined) as 'primary' | undefined,
    href,
    target: '_blank',
  }
}

export function useSatsbackApi() {
  const toast = useToast()
  const confirm = useConfirmDialog()
  const token = useSatsbackToken()
  const userId = useSatsbackUserId()
  const { $satsbackFetch } = useNuxtApp()

  async function getUserToken() {
    let signedEventGetToken
    try {
      // The catch block below recognises this exact wording to surface
      // the "install Nostr extension" confirm. Without this explicit
      // check the `?.` would silently produce `undefined` and the
      // downstream /api/satsback/get-token call would just 4xx with no
      // visible feedback to the user.
      if (!(window as NostrWindow).nostr)
        throw new Error('window.nostr is undefined')
      signedEventGetToken = await (window as NostrWindow).nostr?.signEvent({
        kind: SATSBACK_NOSTR_GET_TOKEN_KIND,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['partner', 'gospendl'], ['country', 'de']],
        content: 'get-token',
      })
    }
    catch (error: unknown) {
      let errorMessage = 'Unknown'
      if (String(error).includes('denied')) {
        errorMessage = 'Nostr authentification events declined'
        toast.add({ title: 'Nostr Events declined', description: 'Please accept the nostr events used for authentification, otherwise we cannot provide your personalized shop link', color: 'error' })
      }
      else if (String(error).includes('window.nostr is undefined')) {
        errorMessage = 'Cannot sign events cause Nostr authentification not possible. Need window.nostr that is given by browser extentions'
        const browser = detectBrowser()
        await confirm({
          title: 'Missing browser extention for nostr authentification',
          description: 'Please install the browser extention "nos2x" or "Alby"',
          linkGroups: {
            nos2x: [
              buildExtensionLink('chrome', 'https://chromewebstore.google.com/detail/nos2x/kpgefcfmnafjgpblomihpgmejjdanjjp', browser),
              buildExtensionLink('firefox', 'https://addons.mozilla.org/en-US/firefox/addon/nos2x-fox/', browser),
            ],
            Alby: [
              buildExtensionLink('chrome', 'https://chromewebstore.google.com/detail/alby-bitcoin-wallet-for-l/iokeahhehimjnekafflcihljlcjccdbe', browser),
              buildExtensionLink('firefox', 'https://addons.mozilla.org/en-US/firefox/addon/alby/', browser),
            ],
          },
        })
      }
      throw new Error(errorMessage)
    }
    const resp = await $fetch<{ userId: string, token: string }>('/api/satsback/get-token', { method: 'post', body: signedEventGetToken })
    token.value = resp.token
    userId.value = resp.userId
    return resp
  }

  async function createUser() {
    let signedEventCreate
    try {
      let email
      const confirmed = await confirm({
        title: 'New account: Enter your Lightning address',
        description: 'We need your Lightning address to be able to payout your gathered Satsback',
        setEmail: (value?: string) => {
          email = value
        },

        linkGroups: {
          0: [
            {
              label: 'About the Lightning Address',
              icon: 'i-custom-lightning',
              variant: 'ghost',
              href: 'https://lightningaddress.com/',
              target: '_blank',
            },
          ],
        },
      })

      if (!confirmed) {
        toast.add({ title: 'Could not create user', description: 'We need your Lightning email to be able to payout your Satsback. If you have no Lightning account yet please create one and try again.', color: 'error' })
        return
      }
      if (!email) {
        throw new Error('Statsback Auth: New account email is not set')
      }

      signedEventCreate = await (window as NostrWindow).nostr?.signEvent({
        kind: SATSBACK_NOSTR_CREATE_USER_KIND,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['partner', 'gospendl'], ['country', 'de'], ['payout_address', email]],
        content: 'create',
      })
    }
    catch (error) {
      let errorMessage = 'Unknown'
      if (String(error).includes('denied')) {
        errorMessage = 'Nostr authentification events declined'
        toast.add({ title: 'Nostr Events declined', description: 'Please accept the nostr events used for authentification, otherwise we cannot provide your personalized shop link', color: 'error' })
      }
      else if (String(error).includes('window.nostr is undefined')) {
        errorMessage = 'Cannot sign events cause Nostr authentification not possible. Need window.nostr that is given by browser extentions'
        // TODO force user to install browser extentions
        toast.add({ title: 'Missing chrome extention for nostr authentification', description: 'Please install the browser extention "nos2x" or "Alby"', color: 'error' })
      }
      throw new Error(errorMessage)
    }
    return await $fetch('/api/satsback/create-user', { method: 'post', body: signedEventCreate })
  }

  async function ensureAuth() {
    if (token.value && userId.value)
      return

    if (!authInProgress) {
      authInProgress = (async () => {
        try {
          await getUserToken()
        }
        catch (error: unknown) {
          const statusCode = (error as { statusCode?: number }).statusCode
          if (statusCode === 404) {
            console.warn('Statsback Auth: GetToken responded with 404. Creating new satsback account')
            try {
              await createUser()
              await getUserToken()
            }
            catch (createError: unknown) {
              const errData = (createError as { data?: { data?: { message?: string } } }).data
              if (errData?.data?.message)
                toast.add({ title: 'Could not create user', description: errData.data.message, color: 'error' })
              throw new Error('Statsback Auth: Could not authorize')
            }
          }
          else {
            throw error
          }
        }
        finally {
          authInProgress = null
        }
      })()
    }

    return authInProgress
  }

  async function getStoreLink(storeId: string) {
    await ensureAuth()
    if (!userId.value)
      return

    // `$satsbackFetch` (from `plugins/satsback-fetch.client.ts`) attaches
    // the Authorization: Bearer ${token} header that the redirect route
    // forwards upstream. Plain `$fetch` would skip it and Satsback's
    // `/store/visit/...` would 404 us back.
    const response = await $satsbackFetch<VisitStoreResponse>('/api/satsback/redirect', {
      method: 'post',
      body: { userId: userId.value, storeId },
    })
    return response.redirect_url
  }
  async function withAuth<T>(call: () => Promise<T>): Promise<T> {
    await ensureAuth()
    return await call()
  }

  function getClicks() {
    return withAuth(() => $satsbackFetch<{ data: UserClickHistoryItem[] }>('/api/satsback/user/clicks'))
  }

  function getHistory() {
    return withAuth(() => $satsbackFetch<{ data: UserHistoryItem[] }>('/api/satsback/user/history'))
  }

  function getPayouts() {
    return withAuth(() => $satsbackFetch<{ data: UserPayoutItem[] }>('/api/satsback/user/payouts'))
  }

  return {
    ensureAuth,
    getStoreLink,
    getClicks,
    getHistory,
    getPayouts,
    hasNostrExtensionSupport,
  }
}
