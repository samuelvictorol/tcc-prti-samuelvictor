import { api } from '../boot/axios'

export const groupService = {
  async list () {
    const { data } = await api.get('/groups')
    return data
  },
  async create (payload) {
    const { data } = await api.post('/groups', payload)
    return data
  },
  async remove (id) {
    const { data } = await api.delete(`/groups/${id}`)
    return data
  }
}
