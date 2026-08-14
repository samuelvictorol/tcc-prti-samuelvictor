<script setup>
import { ref, watch } from 'vue'
import { useWhiteLabel } from '../services/whitelabel.js'

defineProps({ compact: { type: Boolean, default: false } })

const { branding } = useWhiteLabel()
const logoFailed = ref(false)
watch(() => branding.logoUrl, () => { logoFailed.value = false })
</script>

<template>
  <div :class="['white-label-brand', { 'white-label-brand--compact': compact }]">
    <span class="white-label-brand__mark">
      <img
        v-if="branding.logoUrl && !logoFailed"
        :src="branding.logoUrl"
        :alt="`Logo ${branding.appName}`"
        referrerpolicy="no-referrer"
        @error="logoFailed = true"
      >
      <q-icon v-else name="notifications_active" aria-hidden="true" />
    </span>
    <span class="white-label-brand__name">{{ branding.appName }}</span>
  </div>
</template>

<style scoped>
.white-label-brand {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.white-label-brand__mark {
  display: grid;
  width: 38px;
  height: 38px;
  flex: none;
  overflow: hidden;
  border-radius: 13px;
  background: linear-gradient(135deg, var(--mint), var(--brand));
  box-shadow: 0 9px 24px color-mix(in srgb, var(--brand) 27%, transparent);
  color: var(--ink);
  place-items: center;
}

.white-label-brand__mark img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.white-label-brand__name {
  overflow: hidden;
  color: var(--ink);
  font-size: 1.18rem;
  font-weight: 760;
  letter-spacing: -0.04em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 420px) {
  .white-label-brand--compact .white-label-brand__name {
    display: none;
  }

  .white-label-brand__mark {
    width: 34px;
    height: 34px;
  }
}
</style>
