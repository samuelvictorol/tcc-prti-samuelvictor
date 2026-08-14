<script setup>
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import WhiteLabelFooter from './components/WhiteLabelFooter.vue'
import { useWhiteLabel } from './services/whitelabel.js'

const route = useRoute()
const whiteLabel = useWhiteLabel()
const layoutOwnsFooter = computed(() => route.matched.some((record) => record.path === '/') || route.name === 'my-profile')
onMounted(() => whiteLabel.load())
</script>

<template>
  <div :class="['app-root', { 'app-root--public': !layoutOwnsFooter }]">
    <div class="app-route"><router-view /></div>
    <WhiteLabelFooter v-if="!layoutOwnsFooter" />
  </div>
</template>

<style>
.app-root {
  min-height: 100dvh;
}

.app-root--public {
  display: grid;
  height: 100dvh;
  grid-template-rows: minmax(0, 1fr) auto;
  overflow: hidden;
}

.app-root--public > .app-route {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  overflow: auto;
}

.app-root--public > .app-route > * {
  width: 100%;
  min-height: 0;
  flex: 1 1 auto;
}

.app-root--public .login-page {
  min-height: 0 !important;
}

.app-root--public .login-story,
.app-root--public .login-panel,
.app-root--public .public-page,
.app-root--public .not-found {
  min-height: 100% !important;
}
</style>
