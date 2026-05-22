<script setup>
defineProps({
  status: { type: Object, required: true },
  loading: { type: Boolean, default: false }
})
</script>

<template>
  <section class="meta-banner" :class="status.whatsappConfigured || status.configured ? 'ok' : 'warn'">
    <div>
      <strong>
        {{ status.whatsappConfigured || status.configured ? 'Meta WhatsApp Cloud API configurada' : 'Meta WhatsApp Cloud API ainda não configurada' }}
      </strong>
      <p v-if="loading">Verificando configuração...</p>
      <p v-else>
        {{ status.message || 'Cadastros e simulações continuam disponíveis. O envio real depende das variáveis da Meta.' }}
      </p>
    </div>

    <div v-if="status.missingVariables?.length" class="chips">
      <span v-for="item in status.missingVariables" :key="item">
        {{ item }}
      </span>
    </div>
  </section>
</template>
