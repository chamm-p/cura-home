import api from './api'

export interface LlmBackend {
  id: string
  name: string
  api_base_url: string
  model_id: string
  capabilities: { supports_vision?: boolean; supports_tools?: boolean }
  is_active: boolean
  has_api_key: boolean
}

export interface LlmBackendPayload {
  name: string
  api_base_url: string
  api_key?: string | null
  model_id: string
  supports_vision: boolean
  supports_tools: boolean
  is_active: boolean
}

export const listBackends = () =>
  api.get<LlmBackend[]>('/api/settings/llm-backends').then((r) => r.data)
export const createBackend = (body: LlmBackendPayload) =>
  api.post<LlmBackend>('/api/settings/llm-backends', body).then((r) => r.data)
export const updateBackend = (id: string, body: Partial<LlmBackendPayload>) =>
  api.put<LlmBackend>(`/api/settings/llm-backends/${id}`, body).then((r) => r.data)
export const deleteBackend = (id: string) =>
  api.delete(`/api/settings/llm-backends/${id}`)
export const testBackend = (id: string) =>
  api
    .post<{ ok: boolean; sample?: string; error?: string }>(
      `/api/settings/llm-backends/${id}/test`,
    )
    .then((r) => r.data)

export const getKv = (key: string) =>
  api.get<{ value: Record<string, unknown> }>(`/api/settings/kv/${key}`).then((r) => r.data.value)
export const putKv = (key: string, value: Record<string, unknown>) =>
  api.put<{ value: Record<string, unknown> }>(`/api/settings/kv/${key}`, { value }).then((r) => r.data.value)
