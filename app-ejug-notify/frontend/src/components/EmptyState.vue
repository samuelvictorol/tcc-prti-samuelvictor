<script setup>
defineProps({
  title: { type: String, default: 'Nenhum registro encontrado' },
  description: { type: String, default: 'Crie o primeiro registro para iniciar o fluxo.' }
})
</script>

<template>
  <div class="empty-state">
    <strong>{{ title }}</strong>
    <p>{{ description }}</p>
  </div>
</template>
