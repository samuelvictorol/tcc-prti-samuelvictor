<script setup>
import { onMounted, reactive, ref } from 'vue'
import AppLayout from '../layouts/AppLayout.vue'
import AlertMessage from '../components/AlertMessage.vue'
import { useResourceList } from '../composables/useResourceList'
import { contactService } from '../services/contact.service'
import { campaignService } from '../services/campaign.service'
import { getErrorMessage } from '../utils/error.util'

const contacts = useResourceList(contactService)
const loading = ref(false)
const error = ref('')
const success = ref('')

const form = reactive({
  contactId: '',
  message: 'Olá, {{nome}}! Este é um teste institucional da EJUG Notify.'
})

async function submit () {
  loading.value = true
  error.value = ''
  success.value = ''

  try {
    const data = await campaignService.quickNotify({ ...form })
    success.value = data?.message || 'Notificação processada.'
  } catch (err) {
    error.value = getErrorMessage(err)
  } finally {
    loading.value = false
  }
}

onMounted(contacts.load)
</script>

<template>
  <AppLayout>
    <section class="panel narrow">
      <h2>Notificação rápida</h2>
      <p class="muted">
        Use este módulo para validar o fluxo individual. Sem credenciais da Meta,
        o backend registra a simulação e retorna uma mensagem segura.
      </p>

      <form class="form" @submit.prevent="submit">
        <label>
          Contato
          <select v-model="form.contactId" required>
            <option value="">Selecione</option>
            <option v-for="contact in contacts.items.value" :key="contact.id" :value="contact.id">
              {{ contact.name }} · {{ contact.phone }}
            </option>
          </select>
        </label>

        <label>Mensagem <textarea v-model="form.message" rows="8" required /></label>

        <AlertMessage type="danger" :message="error" />
        <AlertMessage type="success" :message="success" />

        <button class="btn primary" :disabled="loading">
          {{ loading ? 'Processando...' : 'Enviar / Simular' }}
        </button>
      </form>
    </section>
  </AppLayout>
</template>
