<script setup lang="ts">
import { ref, useId } from 'vue';

defineProps<{ label?: string; modelValue?: unknown; placeholder?: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const fieldId = useId();
const focused = ref(false);
</script>

<template>
  <div class="inputContainer">
    <label class="inputLabel" :class="focused ? 'inputLabelFocused' : 'inputLabelUnfocused'" :for="fieldId"
      v-if="label">
      {{ label }}
    </label>
    <input :id="fieldId" class="emby-input" type="text" :value="String(modelValue ?? '')" :placeholder="placeholder"
      @focus="focused = true" @blur="focused = false"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)">
  </div>
</template>
