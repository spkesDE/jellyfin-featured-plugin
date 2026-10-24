<script setup lang="ts">
import { useId } from 'vue';
import ConfigHelpTooltip from './ConfigHelpTooltip.vue';

defineProps<{ label: string; helpText?: string; modelValue?: unknown; disabled?: boolean; hideLabel?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();
const fieldId = useId();
</script>

<template>
  <div class="featured-switchRow" :class="{ 'is-labelHidden': hideLabel }">
    <div v-if="!hideLabel" class="featured-switchLabelRow featured-configLabelRow">
      <label class="featured-switchLabel" :for="fieldId">{{ label }}</label>
      <ConfigHelpTooltip v-if="helpText" :text="helpText" :label="`${label}: ${helpText}`" />
    </div>
    <span class="featured-switch">
      <input
        :id="fieldId"
        class="featured-switchInput"
        type="checkbox"
        role="switch"
        :aria-label="hideLabel ? label : undefined"
        :disabled="disabled"
        :checked="modelValue === true"
        @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
      />
      <span class="featured-switchTrack" aria-hidden="true"></span>
    </span>
  </div>
</template>

<style scoped>
.featured-switchRow {
  align-items: center;
  display: flex;
  gap: 0.75rem;
  justify-content: space-between;
  min-height: 2.4rem;
}
.featured-switchRow.is-labelHidden {
  min-height: 0;
}
.featured-switchLabel {
  cursor: pointer;
}
.featured-switch {
  display: inline-flex;
  flex: 0 0 auto;
  height: 1.25rem;
  position: relative;
  width: 2.25rem;
}
.featured-switchInput {
  cursor: pointer;
  height: 100%;
  inset: 0;
  margin: 0;
  opacity: 0;
  position: absolute;
  width: 100%;
  z-index: 1;
}
.featured-switchInput:disabled {
  cursor: default;
}
.featured-switchTrack {
  background: var(--featured-theme-action-focus);
  border-radius: 999px;
  inset: 0;
  position: absolute;
  transition: background 0.16s ease;
}
.featured-switchTrack::after {
  background: var(--featured-theme-text-primary);
  border-radius: 50%;
  content: '';
  height: 0.95rem;
  left: 0.15rem;
  position: absolute;
  top: 0.15rem;
  transition: transform 0.16s ease;
  width: 0.95rem;
}
.featured-switchInput:checked + .featured-switchTrack {
  background: var(--featured-theme-primary);
}
.featured-switchInput:checked + .featured-switchTrack::after {
  background: var(--featured-theme-primary-contrast);
  transform: translateX(1rem);
}
.featured-switchInput:focus-visible + .featured-switchTrack {
  outline: 2px solid var(--featured-theme-primary);
  outline-offset: 2px;
}
.featured-switchInput:disabled + .featured-switchTrack {
  opacity: 0.4;
}
</style>
