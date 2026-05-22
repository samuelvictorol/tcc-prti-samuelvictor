<script setup>
import { onMounted, reactive } from 'vue'
import AppLayout from '../layouts/AppLayout.vue'
import AlertMessage from '../components/AlertMessage.vue'
import DataCard from '../components/DataCard.vue'
import EmptyState from '../components/EmptyState.vue'
import { useResourceList } from '../composables/useResourceList'
import { contactService } from '../services/contact.service'

const resource = useResourceList(contactService)

const form = reactive({
  name: '',
  phone: '',
  email: '',
  document: '',
  source: 'Cadastro manual',
  hasOptIn: true
})

function reset () {
  form.name = ''
  form.phone = ''
  form.email = ''
  form.document = ''
  form.source = 'Cadastro manual'
  form.hasOptIn = true
}

async function submit () {
  const ok = await resource.create({ ...form }, 'Contato cadastrado com sucesso.')
  if (ok) reset()
}

async function toggleOptIn (contact, value) {
  if (value) await contactService.optIn(contact.id || contact._id)
  else await contactService.optOut(contact.id || contact._id)
  await resource.load()
}

onMounted(resource.load)
</script>

<template>
  <AppLayout>
    <section class="page-grid">
      <form class="panel form" @submit.prevent="submit">
        <h2>Novo contato</h2>

        <label>Nome <input v-model="form.name" required placeholder="Maria Silva" /></label>
        <label>Telefone <input v-model="form.phone" required placeholder="5562999999999" /></label>
        <label>E-mail <input v-model="form.email" type="email" placeholder="opcional" /></label>
        <label>Documento/Matrícula <input v-model="form.document" placeholder="opcional" /></label>
        <label>Origem <input v-model="form.source" /></label>

        <label class="check">
          <input v-model="form.hasOptIn" type="checkbox" />
          Possui consentimento para receber notificações
        </label>

        <AlertMessage type="danger" :message="resource.error.value" />
        <AlertMessage type="success" :message="resource.success.value" />

        <button class="btn primary" :disabled="resource.saving.value">Salvar contato</button>
      </form>

      <section class="panel">
        <h2>Contatos cadastrados</h2>

        <EmptyState v-if="!resource.loading.value && !resource.items.value.length" />

        <div class="cards-list">
          <DataCard
            v-for="contact in resource.items.value"
            :key="contact.id"
            :title="contact.name"
            :subtitle="`${contact.phone}${contact.email ? ' · ' + contact.email : ''}`"
            :badge="contact.hasOptIn ? 'Opt-in ativo' : 'Sem opt-in'"
          >
            <div class="actions">
              <button class="btn small" @click="toggleOptIn(contact, true)">Marcar opt-in</button>
              <button class="btn small ghost-light" @click="toggleOptIn(contact, false)">Opt-out</button>
            </div>
          </DataCard>
        </div>
      </section>
    </section>
  </AppLayout>
</template>
