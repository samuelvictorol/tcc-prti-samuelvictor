import { ref } from 'vue'
import { getErrorMessage } from '../utils/error.util'

export function useResourceList (service) {
  const items = ref([])
  const loading = ref(false)
  const saving = ref(false)
  const error = ref('')
  const success = ref('')

  function normalizeList (data) {
    if (Array.isArray(data)) return data
    if (Array.isArray(data?.items)) return data.items
    if (Array.isArray(data?.data)) return data.data
    return []
  }

  async function load () {
    loading.value = true
    error.value = ''

    try {
      const data = await service.list()
      items.value = normalizeList(data)
    } catch (err) {
      error.value = getErrorMessage(err)
    } finally {
      loading.value = false
    }
  }

  async function create (payload, message = 'Registro criado com sucesso.') {
    saving.value = true
    error.value = ''
    success.value = ''

    try {
      await service.create(payload)
      success.value = message
      await load()
      return true
    } catch (err) {
      error.value = getErrorMessage(err)
      return false
    } finally {
      saving.value = false
    }
  }

  return {
    items,
    loading,
    saving,
    error,
    success,
    load,
    create
  }
}
