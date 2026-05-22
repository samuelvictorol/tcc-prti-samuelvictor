<script setup>
import { onMounted, reactive } from 'vue'
import AppLayout from '../layouts/AppLayout.vue'
import AlertMessage from '../components/AlertMessage.vue'
import DataCard from '../components/DataCard.vue'
import EmptyState from '../components/EmptyState.vue'
import { useResourceList } from '../composables/useResourceList'
import { campaignService } from '../services/campaign.service'
import { groupService } from '../services/group.service'
import { templateService } from '../services/template.service'
import { getErrorMessage } from '../utils/error.util'
import { formatDateTime } from '../utils/date.util'

const campaigns = useResourceList(campaignService)
const groups = useResourceList(groupService)
const templates = useResourceList(templateService)

const form = reactive({
  name: '',
  groupId: '',
  templateId: '',
  scheduledAt: ''
})

async function submit () {
  const ok = await campaigns.create({ ...form }, 'Campanha criada com sucesso.')
  if (ok) {
    form.name = ''
    form.groupId = ''
    form.templateId = ''
    form.scheduledAt = ''
  }
}

async function dispatchCampaign (id) {
  campaigns.error.value = ''
  campaigns.success.value = ''

  try {
    const data = await campaignService.dispatch(id)
    campaigns.success.value = data?.message || 'Campanha processada com sucesso.'
    await campaigns.load()
  } catch (err) {
    campaigns.error.value = getErrorMessage(err)
  }
}

onMounted(() => {
  campaigns.load()
  groups.load()
  templates.load()
})
</script>

<template>
  <AppLayout>
    <section class="page-grid">
      <form class="panel form" @submit.prevent="submit">
        <h2>Nova campanha</h2>

        <label>Nome <input v-model="form.name" required placeholder="Lembrete aula amanhã" /></label>

        <label>
          Turma
          <select v-model="form.groupId" required>
            <option value="">Selecione</option>
            <option v-for="group in groups.items.value" :key="group.id" :value="group.id">
              {{ group.name }}
            </option>
          </select>
        </label>

        <label>
          Template
          <select v-model="form.templateId" required>
            <option value="">Selecione</option>
            <option v-for="template in templates.items.value" :key="template.id" :value="template.id">
              {{ template.name }}
            </option>
          </select>
        </label>

        <label>Agendamento <input v-model="form.scheduledAt" type="datetime-local" /></label>

        <AlertMessage type="danger" :message="campaigns.error.value" />
        <AlertMessage type="success" :message="campaigns.success.value" />

        <button class="btn primary">Criar campanha</button>
      </form>

      <section class="panel">
        <h2>Campanhas</h2>

        <EmptyState v-if="!campaigns.loading.value && !campaigns.items.value.length" />

        <div class="cards-list">
          <DataCard
            v-for="campaign in campaigns.items.value"
            :key="campaign.id"
            :title="campaign.name"
            :subtitle="`Agendamento: ${formatDateTime(campaign.scheduledAt)}`"
            :badge="campaign.status"
          >
            <div class="actions">
              <button class="btn small" @click="dispatchCampaign(campaign.id)">Processar campanha</button>
            </div>
          </DataCard>
        </div>
      </section>
    </section>
  </AppLayout>
</template>
