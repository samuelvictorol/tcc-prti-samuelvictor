<script setup>
defineProps({
  message: { type: String, default: '' },
  type: { type: String, default: 'info' }
})
</script>

<template>
  <div v-if="message" class="alert" :class="`alert--${type}`">
    {{ message }}
  </div>
</template>
