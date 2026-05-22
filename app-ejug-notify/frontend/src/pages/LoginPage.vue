<script setup>
import { reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import AlertMessage from '../components/AlertMessage.vue'

const router = useRouter()
const { login, loading, error } = useAuth()

const form = reactive({
  email: 'admin@ejug.local',
  password: 'admin123'
})

async function submit () {
  await login(form)
  router.push('/')
}
</script>

<template>
  <main class="login-page">
    <section class="login-card">
      <div class="login-mark">E</div>

      <small>Plataforma institucional</small>
      <h1>EJUG Notify</h1>

      <p>
        Gestão de contatos, turmas, templates e campanhas com arquitetura preparada
        para WhatsApp Cloud API oficial.
      </p>

      <form class="form" @submit.prevent="submit">
        <label>
          E-mail
          <input v-model="form.email" type="email" required />
        </label>

        <label>
          Senha
          <input v-model="form.password" type="password" required />
        </label>

        <AlertMessage type="danger" :message="error" />

        <button class="btn primary" :disabled="loading">
          {{ loading ? 'Entrando...' : 'Entrar no painel' }}
        </button>
      </form>
    </section>
  </main>
</template>
