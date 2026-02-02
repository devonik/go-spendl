import type { VisitStoreResponse } from '~~/types/satsback'

const SATSBACK_NOSTR_GET_TOKEN_KIND = 27237
const SATSBACK_NOSTR_CREATE_USER_KIND = 27236

export function useSatsbackApi() {
  const toast = useToast()
  const confirm = useConfirmDialog()

  async function getUserToken() {
    let signedEventGetToken
    try {
      signedEventGetToken = await window.nostr.signEvent({
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
        toast.add({ title: 'Missing chrome extention for nostr authentification', description: 'Please install the browser extention "nos2x" or "Alby"', color: 'error' })
      }
      throw new Error(errorMessage)
    }
    return await $fetch('/api/satsback/get-token', { method: 'post', body: signedEventGetToken })
  }
  async function createUser() {
    let signedEventCreate
    try {
      let email
      const confirmed = await confirm({
        title: 'New account: Enter your Lightning email',
        description: 'We need your Lightning email to be able to payout your gathered Satsback',
        setEmail: (value: string) => {
          email = value
        },
      })
      console.log('dialog confirmed', confirmed)

      if (!confirmed) {
        toast.add({ title: 'Could not create user', description: 'We need your Lightning email to be able to payout your Satsback. If you have no Lightning account yet please create one and try again.', color: 'error' })
        return
      }
      if (!email) {
        throw new Error('Statsback Auth: New account email is not set')
      }

      signedEventCreate = await window.nostr.signEvent({
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

  async function getStoreLink(storeId: string) {
    let userId
    try {
      const userTokenResp = await getUserToken()
      userId = userTokenResp?.userId
    }
    catch (error) {
      if (error.statusCode === 404) {
        console.warn('Statsback Auth: GetToken reponded with 404. You have to create a new satsback account')
        try {
          const createUserResp = await createUser()
          userId = createUserResp?.userId
        }
        catch (error) {
          if (error.data.data && error.data.data.message)
            toast.add({ title: 'Could not create user', description: error.data.data.message, color: 'error' })
          throw new Error('Statsback Auth: Could not authorize')
        }
      }
    }
    if (!userId)
      return
    const response = await $fetch<VisitStoreResponse>('/api/satsback/redirect', {
      method: 'post',
      body: {
        userId,
        storeId,
      },
    })
    return response.redirect_url
  }
  return {
    getStoreLink,
  }
}
