import api from './api'

export interface Area {
  id: string
  name: string
  sort_order: number
}

export interface Photo {
  id: string
  url: string
  thumb_url: string
  is_primary: boolean
}

export interface Item {
  id: string
  area_id: string | null
  name: string | null
  category: string | null
  description: string | null
  price_new: number | null
  price_source: string | null
  price_determined_at: string | null
  is_catalogued: boolean
  for_sale: boolean
  for_disposal: boolean
  needs_verification: boolean
  custom_values: Record<string, unknown>
  created_at: string
  updated_at: string
  photos: Photo[]
}

export interface AreaSummary {
  area_id: string | null
  area_name: string
  item_count: number
  total_price: number
  items_without_price: number
}

export interface InventorySummary {
  by_area: AreaSummary[]
  total_price: number
  total_items: number
}

export interface CaptureResult {
  item: Item
  // 'pending' = Vision läuft im Hintergrund, 'skipped' = kein Vision-Backend
  vision_status: 'pending' | 'skipped'
}

// ─── Areas ───
export const listAreas = () => api.get<Area[]>('/api/areas').then((r) => r.data)
export const createArea = (name: string) =>
  api.post<Area>('/api/areas', { name }).then((r) => r.data)
export const updateArea = (id: string, body: Partial<Area>) =>
  api.put<Area>(`/api/areas/${id}`, body).then((r) => r.data)
export const deleteArea = (id: string) => api.delete(`/api/areas/${id}`)

// ─── Items ───
export interface ItemFilters {
  area_id?: string | null
  uncatalogued?: boolean
  no_price?: boolean
  category?: string | null
  needs_verification?: boolean
  for_sale?: boolean
  for_disposal?: boolean
}

export function listItems(filters: ItemFilters = {}) {
  const params: Record<string, string> = {}
  if (filters.area_id) params.area_id = filters.area_id
  if (filters.uncatalogued) params.uncatalogued = 'true'
  if (filters.no_price) params.no_price = 'true'
  if (filters.category) params.category = filters.category
  if (filters.needs_verification) params.needs_verification = 'true'
  if (filters.for_sale) params.for_sale = 'true'
  if (filters.for_disposal) params.for_disposal = 'true'
  return api.get<Item[]>('/api/items', { params }).then((r) => r.data)
}

export const getItem = (id: string) =>
  api.get<Item>(`/api/items/${id}`).then((r) => r.data)

export interface ItemPayload {
  area_id?: string | null
  name?: string | null
  category?: string | null
  description?: string | null
  price_new?: number | null
  is_catalogued?: boolean
  for_sale?: boolean
  for_disposal?: boolean
  needs_verification?: boolean
  custom_values?: Record<string, unknown>
}

export const createItem = (body: ItemPayload) =>
  api.post<Item>('/api/items', body).then((r) => r.data)
export const updateItem = (id: string, body: ItemPayload) =>
  api.put<Item>(`/api/items/${id}`, body).then((r) => r.data)
export const deleteItem = (id: string) => api.delete(`/api/items/${id}`)

export const getSummary = () =>
  api.get<InventorySummary>('/api/items/summary').then((r) => r.data)

export function capture(file: File, areaId: string | null) {
  const form = new FormData()
  form.append('file', file)
  if (areaId) form.append('area_id', areaId)
  return api.post<CaptureResult>('/api/items/capture', form).then((r) => r.data)
}

export function addPhoto(itemId: string, file: File) {
  const form = new FormData()
  form.append('file', file)
  return api.post<Item>(`/api/items/${itemId}/photos`, form).then((r) => r.data)
}

// Erneute Vision-Erkennung eines bestehenden Objekts (anhand seines Fotos).
export const recognizeItem = (itemId: string) =>
  api.post<Item>(`/api/items/${itemId}/recognize`).then((r) => r.data)

// ─── Vision ───
export const visionStatus = () =>
  api
    .get<{ available: boolean; backend: string | null }>('/api/vision/status')
    .then((r) => r.data)
