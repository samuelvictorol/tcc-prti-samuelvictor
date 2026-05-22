import { computed, ref } from 'vue'
import { authService } from '../services/auth.service'
import { getErrorMessage } from '../utils/error.util'

function readUser () {
  try {
    return JSON.parse(localStorage.getItem('ejug:user') || 'null')
  } catch {
    return null
  }
}

const user = ref(readUser())
const token = ref(localStorage.getItem('ejug:token') || '')
const loading = ref(false)
const error = ref('')

export function useAuth () {
  const isAuthenticated = computed(() => Boolean(token.value))

  async function login (payload) {
    loading.value = true
    error.value = ''

    try {
      const data = await authService.login(payload)
      token.value = data.token
      user.value = data.user

      localStorage.setItem('ejug:token', data.token)
      localStorage.setItem('ejug:user', JSON.stringify(data.user))

      return data
    } catch (err) {
      error.value = getErrorMessage(err, 'Erro ao realizar login.')
      throw err
    } finally {
      loading.value = false
    }
  }

  function logout () {
    token.value = ''
    user.value = null
    localStorage.removeItem('ejug:token')
    localStorage.removeItem('ejug:user')
  }

  return {
    user,
    token,
    loading,
    error,
    isAuthenticated,
    login,
    logout
  }
}
