<script setup>
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  badge: { type: String, default: '' }
})
</script>

<template>
  <article class="data-card">
    <header>
      <div>
        <h3>{{ title }}</h3>
        <p v-if="subtitle">{{ subtitle }}</p>
      </div>
      <span v-if="badge" class="badge">{{ badge }}</span>
    </header>

    <slot />
  </article>
</template>
