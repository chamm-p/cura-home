import api from './api'

export interface PriceEstimate {
  price: number | null
  currency: string
  sources: string[]
  mode: string
  note: string | null
}

export interface PricingStatus {
  available: boolean
  mode: string
  backend: string | null
}

export const pricingStatus = () =>
  api.get<PricingStatus>('/api/pricing/status').then((r) => r.data)

export const estimatePrice = (name: string, description?: string | null) =>
  api
    .post<PriceEstimate>('/api/pricing/estimate', { name, description })
    .then((r) => r.data)
