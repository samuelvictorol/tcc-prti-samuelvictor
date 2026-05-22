import { api } from '../boot/axios'

export const authService = {
  async login (payload) {
    const { data } = await api.post('/auth/login', payload)
    return data
  },
  async me () {
    const { data } = await api.get('/auth/me')
    return data
  }
}
