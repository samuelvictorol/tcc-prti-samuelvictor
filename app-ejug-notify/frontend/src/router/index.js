import { createRouter, createWebHistory } from 'vue-router'

import LoginPage from '../pages/LoginPage.vue'
import DashboardPage from '../pages/DashboardPage.vue'
import ContactsPage from '../pages/ContactsPage.vue'
import GroupsPage from '../pages/GroupsPage.vue'
import TemplatesPage from '../pages/TemplatesPage.vue'
import CampaignsPage from '../pages/CampaignsPage.vue'
import QuickNotifyPage from '../pages/QuickNotifyPage.vue'

const routes = [
  { path: '/login', component: LoginPage, meta: { public: true } },
  { path: '/', component: DashboardPage },
  { path: '/contacts', component: ContactsPage },
  { path: '/groups', component: GroupsPage },
  { path: '/templates', component: TemplatesPage },
  { path: '/campaigns', component: CampaignsPage },
  { path: '/quick-notify', component: QuickNotifyPage }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to) => {
  const token = localStorage.getItem('ejug:token')

  if (!to.meta.public && !token) return '/login'
  if (to.path === '/login' && token) return '/'

  return true
})

export default router
