import type { UserClickHistoryItem, VisitStoreResponse } from '~~/types/satsback'

const SATSBACK_NOSTR_GET_TOKEN_KIND = 27237
const SATSBACK_NOSTR_CREATE_USER_KIND = 27236

type NostrWindow = Window & { nostr?: { signEvent: (event: object) => Promise<object> } }

export function useSatsbackApi() {
  const toast = useToast()
  const confirm = useConfirmDialog()
  const token = useSatsbackToken()
  const userId = useSatsbackUserId()
  const { $satsbackFetch } = useNuxtApp()

  async function getUserToken() {
    let signedEventGetToken
    try {
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
        // TODO force user to install browser extentions
        await confirm({
          title: 'Missing browser extention for nostr authentification',
          description: 'Please install the browser extention "nos2x" or "Alby"',
          linkGroups: {
            nos2x: [
              {
                label: 'Chrome',
                icon: 'i-custom-chrome',
                variant: 'outline',
                href: 'https://chromewebstore.google.com/detail/nos2x/kpgefcfmnafjgpblomihpgmejjdanjjp',
                target: '_blank',
              },
              {
                label: 'Firefox',
                icon: 'i-custom-firefox',
                variant: 'outline',
                href: 'https://addons.mozilla.org/en-US/firefox/addon/nos2x-fox/',
                target: '_blank',
              },
            ],
            Alby: [
              {
                label: 'Chrome',
                icon: 'i-custom-chrome',
                variant: 'outline',
                href: 'https://chromewebstore.google.com/detail/alby-bitcoin-wallet-for-l/iokeahhehimjnekafflcihljlcjccdbe',
                target: '_blank',
              },
              {
                label: 'Firefox',
                icon: 'i-custom-firefox',
                variant: 'outline',
                href: 'https://addons.mozilla.org/en-US/firefox/addon/alby/',
                target: '_blank',
              },
            ],
          },
        })
      }
      throw new Error(errorMessage)
    }
    const resp = await $fetch('/api/satsback/get-token', { method: 'post', body: signedEventGetToken })
    if (resp && 'token' in resp) {
      token.value = resp.token as string
      userId.value = resp.userId as string
    }
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
    if (token.value && userId.value) return

    try {
      await getUserToken()
    }
    catch (error: unknown) {
      const statusCode = (error as { statusCode?: number }).statusCode
      if (statusCode === 404) {
        console.warn('Statsback Auth: GetToken responded with 404. Creating new satsback account')
        try {
          const createUserResp = await createUser()
          if (createUserResp && 'userId' in createUserResp) {
            userId.value = createUserResp.userId as string
          }
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
  }

  async function getStoreLink(storeId: string) {
    await ensureAuth()
    if (!userId.value) return

    try {
      const response = await $fetch<VisitStoreResponse>('/api/satsback/redirect', {
        method: 'post',
        body: { userId: userId.value, storeId },
      })
      return response.redirect_url
    }
    catch (err: unknown) {
      if ((err as { statusCode?: number }).statusCode === 401) {
        token.value = null
        userId.value = null
        await ensureAuth()
        if (!userId.value) return
        const response = await $fetch<VisitStoreResponse>('/api/satsback/redirect', {
          method: 'post',
          body: { userId: userId.value, storeId },
        })
        return response.redirect_url
      }
      throw err
    }
  }
  async function getClicks() {
    if (!token.value) {
      await getUserToken()
    }
    try {
      return await $satsbackFetch<{ data: UserClickHistoryItem[] }>('/api/satsback/user/clicks')
    }
    catch (err: unknown) {
      if ((err as { statusCode?: number }).statusCode === 401) {
        token.value = null
        await getUserToken()
        return await $satsbackFetch<{ data: UserClickHistoryItem[] }>('/api/satsback/user/clicks')
      }
      throw err
    }
  }

  return {
    getStoreLink,
    getClicks,
  }
}
