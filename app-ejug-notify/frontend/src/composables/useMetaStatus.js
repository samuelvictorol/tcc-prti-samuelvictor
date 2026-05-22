import { onMounted, ref } from 'vue'
import { metaService } from '../services/meta.service'

export function useMetaStatus () {
  const loading = ref(false)
  const status = ref({
    configured: false,
    whatsappConfigured: false,
    missingVariables: []
  })

  async function loadStatus () {
    loading.value = true

    try {
      status.value = await metaService.status()
    } catch {
      status.value = {
        configured: false,
        whatsappConfigured: false,
        missingVariables: ['API_OFFLINE'],
        message: 'API indisponível no momento.'
      }
    } finally {
      loading.value = false
    }
  }

  onMounted(loadStatus)

  return {
    loading,
    status,
    loadStatus
  }
}
