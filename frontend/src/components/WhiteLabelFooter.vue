<script setup>
import { useWhiteLabel } from '../services/whitelabel.js'

const { branding } = useWhiteLabel()
</script>

<template>
  <footer class="white-label-footer" aria-label="Créditos e links institucionais">
    <span>{{ branding.footer.text }}</span>
    <nav aria-label="Links institucionais">
      <a
        v-if="branding.footer.instagramUrl"
        :href="branding.footer.instagramUrl"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Abrir Instagram em uma nova guia"
      >
        <q-icon name="mdi-instagram" /> Instagram
      </a>
      <a
        v-if="branding.footer.websiteUrl"
        :href="branding.footer.websiteUrl"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Abrir site em uma nova guia"
      >
        <q-icon name="language" /> Site
      </a>
    </nav>
  </footer>
</template>

<style scoped>
.white-label-footer {
  display: flex;
  min-height: 52px;
  align-items: center;
  justify-content: center;
  gap: 18px;
  padding: 11px clamp(18px, 4vw, 42px);
  border-top: 1px solid color-mix(in srgb, var(--brand) 18%, transparent);
  background: color-mix(in srgb, white 82%, var(--mint) 18%);
  color: var(--muted);
  font-size: 0.78rem;
  text-align: center;
}

:global(.q-footer) .white-label-footer {
  min-height: 46px;
  padding-block: 8px;
}

nav {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 14px;
}

a {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--brand-dark);
  font-weight: 750;
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

@media (max-width: 520px) {
  .white-label-footer {
    flex-direction: column;
    gap: 7px;
  }
}
</style>
