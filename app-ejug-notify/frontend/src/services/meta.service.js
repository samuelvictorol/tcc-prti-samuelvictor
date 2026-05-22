import { api } from '../boot/axios'

export const metaService = {
  async status () {
    const { data } = await api.get('/meta/status')
    return data
  }
}
