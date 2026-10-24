<script setup lang="ts">
import ConfigHelpTooltip from './ConfigHelpTooltip.vue';

defineProps<{ title: string; helpText?: string }>();
</script>

<template>
  <section class="featured-configSection">
    <div class="featured-configSectionTitle">
      <h4>{{ title }}</h4>
      <ConfigHelpTooltip v-if="helpText" :text="helpText" :label="`${title}: ${helpText}`" />
      <div v-if="$slots.actions" class="featured-configSectionActions">
        <slot name="actions" />
      </div>
    </div>
    <slot />
  </section>
</template>

<style scoped>
.featured-configSection {
  align-content: start;
  border-top: 1px solid var(--featured-theme-divider);
  display: grid;
  gap: 0.6rem;
  padding: 0.9rem 0 0.2rem;
}
/* Space above the divider so it doesn't sit on the previous section's last field. */
.featured-configSection + .featured-configSection {
  margin-top: 0.9rem;
}
.featured-configSection:first-child {
  border-top: 0;
  padding-top: 0;
}
.featured-configSectionTitle {
  align-items: center;
  display: flex;
  gap: 0.4rem;
}
.featured-configSectionActions {
  margin-left: auto;
}
.featured-configSectionTitle h4 {
  color: var(--featured-theme-text-secondary);
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  margin: 0;
  text-transform: uppercase;
}
.featured-configSection > :deep(.inputContainer),
.featured-configSection > :deep(.selectContainer),
.featured-configSection > :deep(.checkboxContainer) {
  margin-bottom: 0;
}
</style>
