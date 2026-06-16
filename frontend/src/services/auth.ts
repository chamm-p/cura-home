import api from './api'
import type { User } from '../store/auth'

export interface AuthConfig {
  oidc_enabled: boolean
  oidc_label: string
  dev_login_enabled: boolean
}

export async function getAuthConfig(): Promise<AuthConfig> {
  const { data } = await api.get<AuthConfig>('/api/auth/config')
  return data
}

export async function startOidcLogin(): Promise<string> {
  const { data } = await api.get<{ url: string }>('/api/auth/oidc/login')
  return data.url
}

export async function devLogin(
  username: string,
  password: string,
): Promise<TokenResponse> {
  const { data } = await api.post<TokenResponse>('/api/auth/dev-login', {
    username,
    password,
  })
  return data
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
}

export async function exchangeOidcCode(
  code: string,
  state: string | null,
): Promise<TokenResponse> {
  const { data } = await api.post<TokenResponse>('/api/auth/oidc/token', { code, state })
  return data
}

export async function fetchMe(): Promise<User> {
  const { data } = await api.get<User>('/api/users/me')
  return data
}
