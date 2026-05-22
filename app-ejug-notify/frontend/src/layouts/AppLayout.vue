<script setup>
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { useMetaStatus } from '../composables/useMetaStatus'
import MetaStatusBanner from '../components/MetaStatusBanner.vue'

const route = useRoute()
const router = useRouter()
const { user, logout } = useAuth()
const { loading, status } = useMetaStatus()

const links = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/contacts', label: 'Contatos', icon: '👥' },
  { to: '/groups', label: 'Turmas', icon: '🏫' },
  { to: '/templates', label: 'Templates', icon: '🧾' },
  { to: '/campaigns', label: 'Campanhas', icon: '🚀' },
  { to: '/quick-notify', label: 'Notificação rápida', icon: '⚡' }
]

const title = computed(() => {
  const map = {
    '/': 'Dashboard',
    '/contacts': 'Contatos',
    '/groups': 'Turmas e grupos',
    '/templates': 'Templates de notificação',
    '/campaigns': 'Campanhas',
    '/quick-notify': 'Notificação rápida'
  }

  return map[route.path] || 'EJUG Notify'
})

function signOut () {
  logout()
  router.push('/login')
}
</script>

<template>
  <div class="shell">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-icon">E</div>
        <div>
          <strong>EJUG Notify</strong>
          <span>WhatsApp oficial</span>
        </div>
      </div>

      <nav class="nav">
        <RouterLink v-for="link in links" :key="link.to" :to="link.to">
          <span>{{ link.icon }}</span>
          {{ link.label }}
        </RouterLink>
      </nav>

      <button class="btn ghost" @click="signOut">Sair</button>
    </aside>

    <main class="main">
      <header class="topbar">
        <div>
          <small>Ambiente Gate 3 · TCC Residência</small>
          <h1>{{ title }}</h1>
        </div>

        <div class="user-pill">
          {{ user?.name || user?.email || 'Admin' }}
        </div>
      </header>

      <MetaStatusBanner :loading="loading" :status="status" />

      <slot />
    </main>
  </div>
</template>
