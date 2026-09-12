<script setup lang="ts">
import { computed, ref, useId } from 'vue';

const props = defineProps<{ label: string; modelValue?: string | null }>();
const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>();
const fieldId = useId();
const focused = ref(false);

const localValue = computed(() => {
  if (!props.modelValue) return '';
  const date = new Date(props.modelValue);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
});

function update(value: string): void {
  emit('update:modelValue', value ? new Date(value).toISOString() : null);
}
</script>

<template>
  <div class="inputContainer">
    <label class="inputLabel" :class="focused ? 'inputLabelFocused' : 'inputLabelUnfocused'" :for="fieldId">{{ label }}</label>
    <input
      :id="fieldId"
      class="emby-input"
      type="datetime-local"
      :value="localValue"
      @focus="focused = true"
      @blur="focused = false"
      @input="update(($event.target as HTMLInputElement).value)"
    >
  </div>
</template>
