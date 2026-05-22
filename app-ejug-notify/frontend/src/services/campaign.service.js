import { api } from '../boot/axios'

export const campaignService = {
  async list () {
    const { data } = await api.get('/campaigns')
    return data
  },
  async create (payload) {
    const { data } = await api.post('/campaigns', payload)
    return data
  },
  async dispatch (id) {
    const { data } = await api.post(`/campaigns/${id}/dispatch`)
    return data
  },
  async quickNotify (payload) {
    const { data } = await api.post('/messages/quick-notify', payload)
    return data
  },
  async remove (id) {
    const { data } = await api.delete(`/campaigns/${id}`)
    return data
  }
}
