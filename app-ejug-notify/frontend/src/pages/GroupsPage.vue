<script setup>
import { onMounted, reactive } from 'vue'
import AppLayout from '../layouts/AppLayout.vue'
import AlertMessage from '../components/AlertMessage.vue'
import DataCard from '../components/DataCard.vue'
import EmptyState from '../components/EmptyState.vue'
import { useResourceList } from '../composables/useResourceList'
import { groupService } from '../services/group.service'
import { contactService } from '../services/contact.service'

const groups = useResourceList(groupService)
const contacts = useResourceList(contactService)

const form = reactive({
  name: '',
  description: '',
  contactIds: []
})

function reset () {
  form.name = ''
  form.description = ''
  form.contactIds = []
}

async function submit () {
  const ok = await groups.create({ ...form }, 'Turma cadastrada com sucesso.')
  if (ok) reset()
}

onMounted(() => {
  groups.load()
  contacts.load()
})
</script>

<template>
  <AppLayout>
    <section class="page-grid">
      <form class="panel form" @submit.prevent="submit">
        <h2>Nova turma</h2>

        <label>Nome <input v-model="form.name" required placeholder="Curso de Formação 2026" /></label>
        <label>Descrição <textarea v-model="form.description" rows="4" /></label>

        <label>
          Contatos
          <select v-model="form.contactIds" multiple size="7">
            <option v-for="contact in contacts.items.value" :key="contact.id" :value="contact.id">
              {{ contact.name }} · {{ contact.phone }}
            </option>
          </select>
        </label>

        <AlertMessage type="danger" :message="groups.error.value" />
        <AlertMessage type="success" :message="groups.success.value" />

        <button class="btn primary">Salvar turma</button>
      </form>

      <section class="panel">
        <h2>Turmas cadastradas</h2>

        <EmptyState v-if="!groups.loading.value && !groups.items.value.length" />

        <div class="cards-list">
          <DataCard
            v-for="group in groups.items.value"
            :key="group.id"
            :title="group.name"
            :subtitle="group.description"
            :badge="`${group.contacts?.length || 0} contatos`"
          />
        </div>
      </section>
    </section>
  </AppLayout>
</template>
