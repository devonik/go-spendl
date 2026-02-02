export interface VisitStoreResponse {
  store_name: string
  click_id: string
  redirect_url: string
}
export interface GetTokenResponse {
  token: string
  user: string
  public_id: string
}
export interface CreateUserResponse {
  success: boolean
  message: string
  satsback_user_id: string
}
