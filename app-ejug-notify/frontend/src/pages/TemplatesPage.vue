<script setup>
import { onMounted, reactive } from 'vue'
import AppLayout from '../layouts/AppLayout.vue'
import AlertMessage from '../components/AlertMessage.vue'
import DataCard from '../components/DataCard.vue'
import EmptyState from '../components/EmptyState.vue'
import { useResourceList } from '../composables/useResourceList'
import { templateService } from '../services/template.service'

const templates = useResourceList(templateService)

const form = reactive({
  name: '',
  category: 'UTILITY',
  language: 'pt_BR',
  metaTemplateName: '',
  body: 'Olá, {{nome}}! Este é um lembrete institucional da EJUG.'
})

function reset () {
  form.name = ''
  form.category = 'UTILITY'
  form.language = 'pt_BR'
  form.metaTemplateName = ''
  form.body = ''
}

async function submit () {
  const ok = await templates.create({ ...form }, 'Template cadastrado com sucesso.')
  if (ok) reset()
}

onMounted(templates.load)
</script>

<template>
  <AppLayout>
    <section class="page-grid">
      <form class="panel form" @submit.prevent="submit">
        <h2>Novo template</h2>

        <label>Nome <input v-model="form.name" required placeholder="Lembrete de aula" /></label>

        <label>
          Categoria
          <select v-model="form.category">
            <option value="UTILITY">Utilidade</option>
            <option value="MARKETING">Marketing</option>
            <option value="AUTHENTICATION">Autenticação</option>
          </select>
        </label>

        <label>Idioma <input v-model="form.language" required /></label>
        <label>Nome na Meta <input v-model="form.metaTemplateName" placeholder="opcional no MVP" /></label>
        <label>Mensagem <textarea v-model="form.body" rows="8" required /></label>

        <AlertMessage type="danger" :message="templates.error.value" />
        <AlertMessage type="success" :message="templates.success.value" />

        <button class="btn primary">Salvar template</button>
      </form>

      <section class="panel">
        <h2>Templates</h2>

        <EmptyState v-if="!templates.loading.value && !templates.items.value.length" />

        <div class="cards-list">
          <DataCard
            v-for="template in templates.items.value"
            :key="template.id"
            :title="template.name"
            :subtitle="template.metaTemplateName || 'Template interno'"
            :badge="template.category"
          >
            <p class="preview">{{ template.body }}</p>
          </DataCard>
        </div>
      </section>
    </section>
  </AppLayout>
</template>
