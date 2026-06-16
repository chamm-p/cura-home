import api from './api'

export interface House {
  id: string
  name: string
  owner_id: string
  role: 'owner' | 'member'
  is_owner: boolean
  member_count: number
}

export interface HouseMember {
  user_id: string
  email: string
  name: string
  role: 'owner' | 'member'
  is_owner: boolean
}

export const listHouses = () => api.get<House[]>('/api/houses').then((r) => r.data)
export const createHouse = (name: string) =>
  api.post<House>('/api/houses', { name }).then((r) => r.data)
export const updateHouse = (id: string, name: string) =>
  api.put<House>(`/api/houses/${id}`, { name }).then((r) => r.data)
export const deleteHouse = (id: string) => api.delete(`/api/houses/${id}`)

export const listMembers = (houseId: string) =>
  api.get<HouseMember[]>(`/api/houses/${houseId}/members`).then((r) => r.data)
export const addMember = (houseId: string, email: string) =>
  api.post<HouseMember>(`/api/houses/${houseId}/members`, { email }).then((r) => r.data)
export const removeMember = (houseId: string, userId: string) =>
  api.delete(`/api/houses/${houseId}/members/${userId}`)
