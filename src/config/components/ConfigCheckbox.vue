<script setup lang="ts">
import ConfigHelpTooltip from './ConfigHelpTooltip.vue';

defineProps<{ label: string; helpText?: string; modelValue?: unknown; disabled?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();
</script>

<template>
  <div class="checkboxContainer">
    <div class="featured-checkboxRow featured-configLabelRow">
      <label class="emby-checkbox-label">
        <input
          class="emby-checkbox"
          type="checkbox"
          :disabled="disabled"
          :checked="modelValue === true"
          @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
        />
        <span class="checkboxLabel">{{ label }}</span>
        <span class="checkboxOutline">
          <span class="material-icons checkboxIcon checkboxIcon-checked check" aria-hidden="true"></span>
          <span class="material-icons checkboxIcon checkboxIcon-unchecked" aria-hidden="true"></span>
        </span>
      </label>
      <ConfigHelpTooltip v-if="helpText" :text="helpText" :label="`${label}: ${helpText}`" />
    </div>
  </div>
</template>
