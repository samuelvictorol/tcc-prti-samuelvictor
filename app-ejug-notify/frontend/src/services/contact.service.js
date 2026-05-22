import { api } from '../boot/axios'

export const contactService = {
  async list (params = {}) {
    const { data } = await api.get('/contacts', { params })
    return data
  },
  async create (payload) {
    const { data } = await api.post('/contacts', payload)
    return data
  },
  async remove (id) {
    const { data } = await api.delete(`/contacts/${id}`)
    return data
  },
  async optIn (id) {
    const { data } = await api.post(`/contacts/${id}/opt-in`)
    return data
  },
  async optOut (id) {
    const { data } = await api.post(`/contacts/${id}/opt-out`)
    return data
  }
}
