<script setup>
import { onMounted, computed } from 'vue'
import AppLayout from '../layouts/AppLayout.vue'
import { useResourceList } from '../composables/useResourceList'
import { contactService } from '../services/contact.service'
import { groupService } from '../services/group.service'
import { templateService } from '../services/template.service'
import { campaignService } from '../services/campaign.service'

const contacts = useResourceList(contactService)
const groups = useResourceList(groupService)
const templates = useResourceList(templateService)
const campaigns = useResourceList(campaignService)

onMounted(() => {
  contacts.load()
  groups.load()
  templates.load()
  campaigns.load()
})

const stats = computed(() => [
  { label: 'Contatos', value: contacts.items.value.length, text: 'base cadastrada' },
  { label: 'Turmas', value: groups.items.value.length, text: 'grupos segmentados' },
  { label: 'Templates', value: templates.items.value.length, text: 'modelos criados' },
  { label: 'Campanhas', value: campaigns.items.value.length, text: 'envios planejados' }
])
</script>

<template>
  <AppLayout>
    <section class="stats-grid">
      <article v-for="item in stats" :key="item.label" class="stat-card">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
        <p>{{ item.text }}</p>
      </article>
    </section>

    <section class="panel">
      <div class="section-title">
        <div>
          <small>Fluxo da solução</small>
          <h2>Comunicação institucional controlada</h2>
        </div>
      </div>

      <div class="flow-grid">
        <div>1. Contatos com opt-in</div>
        <div>2. Organização por turma</div>
        <div>3. Template institucional</div>
        <div>4. Campanha segmentada</div>
        <div>5. Fila assíncrona</div>
        <div>6. Meta Cloud API</div>
      </div>
    </section>
  </AppLayout>
</template>
