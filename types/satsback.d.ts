export interface VisitStoreResponse {
  store_name: string
  click_id: string
  redirect_url: string
}
export interface GetTokenResponse {
  token: string
  // The Nostr public key the user signed with — long hex string.
  user: string
  // Short Satsback-internal user ID (e.g. "2nGv8GQ"), same format as
  // store_id. This is what `/store/visit/{storeId}/{userId}` wants.
  satsback_user_id: string
}
export interface CreateUserResponse {
  success: boolean
  message: string
  satsback_user_id: string
}
export interface UserClickHistoryItem {
  id: string
  store_name: string
  created_at: string
}
export interface UserPayoutItem {
  id: string
  payout_type: string
  amount: string
  status: string
  created_at: string
  updated_at: string
}
export interface UserHistoryItem {
  id: string
  type: string
  amount: number
  status: string
  store_name: string
  order_value: string
  created_at: string
  updated_at: string
}
