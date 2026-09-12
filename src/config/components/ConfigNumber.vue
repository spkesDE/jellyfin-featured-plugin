<script setup lang="ts">
import { ref, useId } from 'vue';
import ConfigHelpTooltip from './ConfigHelpTooltip.vue';

defineProps<{
  label: string;
  helpText?: string;
  modelValue?: unknown;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: number] }>();
const fieldId = useId();
const focused = ref(false);
</script>

<template>
  <div class="inputContainer">
    <div class="ec-numberLabelRow">
      <label
        class="inputLabel"
        :class="focused ? 'inputLabelFocused' : 'inputLabelUnfocused'"
        :for="fieldId"
      >
        {{ label }}
      </label>
      <ConfigHelpTooltip
        v-if="helpText"
        :text="helpText"
        :label="`${label}: ${helpText}`"
      />
    </div>
    <input
      :id="fieldId"
      class="emby-input"
      type="number"
      :min="min"
      :max="max"
      :step="step"
      :disabled="disabled"
      :value="Number(modelValue ?? 0)"
      @focus="focused = true"
      @blur="focused = false"
      @input="emit('update:modelValue', Number(($event.target as HTMLInputElement).value))"
    >
  </div>
</template>

<style scoped>
.ec-numberLabelRow {
  align-items: center;
  display: flex;
  gap: .4rem;
  width: fit-content;
}
</style>
