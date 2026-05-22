import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  timeout: 20000
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ejug:token')

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem('ejug:token')
      localStorage.removeItem('ejug:user')
    }

    return Promise.reject(error)
  }
)
