import { api } from '../boot/axios'

export const templateService = {
  async list () {
    const { data } = await api.get('/templates')
    return data
  },
  async create (payload) {
    const { data } = await api.post('/templates', payload)
    return data
  },
  async remove (id) {
    const { data } = await api.delete(`/templates/${id}`)
    return data
  }
}
