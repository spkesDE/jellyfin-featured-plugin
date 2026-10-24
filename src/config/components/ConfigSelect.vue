<script setup lang="ts">
import { ref, useId } from 'vue';
import ConfigHelpTooltip from './ConfigHelpTooltip.vue';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

defineProps<{
  label: string;
  helpText?: string;
  modelValue?: unknown;
  options: SelectOption[];
  disabled?: boolean;
  /** Keeps the label for assistive technology only, for rows that show column headings instead. */
  hideLabel?: boolean;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const fieldId = useId();
const focused = ref(false);
</script>

<template>
  <div class="selectContainer" :class="{ 'featured-selectNoLabel': hideLabel }">
    <div v-if="!hideLabel" class="featured-selectLabelRow featured-configLabelRow">
      <label class="selectLabel" :class="{ selectLabelFocused: focused }" :for="fieldId">
        {{ label }}
      </label>
      <ConfigHelpTooltip v-if="helpText" :text="helpText" :label="`${label}: ${helpText}`" />
    </div>
    <select
      :id="fieldId"
      class="emby-select emby-select-withcolor"
      :aria-label="hideLabel ? label : undefined"
      :value="String(modelValue ?? '')"
      :disabled="disabled"
      @focus="focused = true"
      @blur="focused = false"
      @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option v-for="option in options" :key="option.value" :value="option.value" :disabled="option.disabled">
        {{ option.label }}
      </option>
    </select>
    <div class="selectArrowContainer" aria-hidden="true">
      <div style="visibility: hidden; display: none">0</div>
      <span class="selectArrow material-icons keyboard_arrow_down"></span>
    </div>
  </div>
</template>

<style scoped>
/* Jellyfin offsets the arrow by the height of the label above the select; without a label it centers on the field. */
.featured-selectNoLabel > .selectArrowContainer {
  top: 50%;
  transform: translateY(-50%);
}
.featured-selectNoLabel .selectArrow {
  margin-top: 0;
}
</style>
