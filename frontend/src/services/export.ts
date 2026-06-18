import api from './api'
import type { ItemFilters } from './inventory'

/**
 * Lädt die Inventarliste als PDF (mit Auth + aktivem Haus über die Header)
 * und öffnet sie in einem neuen Tab — von dort kann gedruckt oder gespeichert
 * werden.
 */
export async function openInventoryPdf(
  filters: ItemFilters = {},
  withImages = false,
): Promise<void> {
  const params: Record<string, string> = {}
  if (filters.area_id) params.area_id = filters.area_id
  if (filters.uncatalogued) params.uncatalogued = 'true'
  if (filters.no_price) params.no_price = 'true'
  if (withImages) params.with_images = 'true'
  const resp = await api.get('/api/export/pdf', { params, responseType: 'blob' })
  const url = URL.createObjectURL(resp.data as Blob)
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
