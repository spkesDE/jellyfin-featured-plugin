<script setup lang="ts">
import { onBeforeUnmount, ref, useId } from 'vue';
import { t } from '../../i18n';
import ConfigHelpTooltip from './ConfigHelpTooltip.vue';

const props = defineProps<{
  label: string;
  helpText?: string;
  modelValue?: unknown;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  /** Shown inside the field while the value is 0, for settings where 0 means "off" or "unlimited". */
  zeroLabel?: string;
  /** Keeps the label for assistive technology only, for rows that show column headings instead. */
  hideLabel?: boolean;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: number] }>();
const fieldId = useId();
const focused = ref(false);

const REPEAT_DELAY_MS = 400;
const REPEAT_INTERVAL_MS = 80;
let repeatTimer: number | null = null;

function decimals(value: number): number {
  const text = String(value);
  return text.includes('.') ? text.length - text.indexOf('.') - 1 : 0;
}

/** Steps like the native spinner: clamped to min/max and rounded to the step's precision. */
function stepBy(direction: 1 | -1): void {
  if (props.disabled) return;
  const step = props.step && props.step > 0 ? props.step : 1;
  const current = Number(props.modelValue ?? 0) || 0;
  let next = Number((current + direction * step).toFixed(decimals(step)));
  if (props.min !== undefined) next = Math.max(props.min, next);
  if (props.max !== undefined) next = Math.min(props.max, next);
  if (next !== current) emit('update:modelValue', next);
}

function startRepeat(direction: 1 | -1, event: PointerEvent): void {
  if (event.button !== 0) return;
  event.preventDefault();
  stopRepeat();
  stepBy(direction);
  repeatTimer = window.setTimeout(function repeat() {
    stepBy(direction);
    repeatTimer = window.setTimeout(repeat, REPEAT_INTERVAL_MS);
  }, REPEAT_DELAY_MS);
}

function stopRepeat(): void {
  if (repeatTimer !== null) window.clearTimeout(repeatTimer);
  repeatTimer = null;
}

onBeforeUnmount(stopRepeat);
</script>

<template>
  <div class="inputContainer">
    <div v-if="!hideLabel" class="featured-numberLabelRow">
      <label class="inputLabel" :class="focused ? 'inputLabelFocused' : 'inputLabelUnfocused'" :for="fieldId">
        {{ label }}
      </label>
      <ConfigHelpTooltip v-if="helpText" :text="helpText" :label="`${label}: ${helpText}`" />
    </div>
    <div class="featured-numberField">
      <input
        :id="fieldId"
        class="emby-input"
        type="number"
        :aria-label="hideLabel ? label : undefined"
        :min="min"
        :max="max"
        :step="step"
        :disabled="disabled"
        :value="Number(modelValue ?? 0)"
        @focus="focused = true"
        @blur="focused = false"
        @keydown.stop
        @keypress.stop
        @keyup.stop
        @input="emit('update:modelValue', Number(($event.target as HTMLInputElement).value))"
      />
      <span v-if="zeroLabel && Number(modelValue ?? 0) === 0" class="featured-numberZeroLabel" aria-hidden="true">
        {{ zeroLabel }}
      </span>
      <!-- Pointer shortcuts only; keyboard users step with the arrow keys inside the field. -->
      <span class="featured-numberStepper" :class="{ 'is-disabled': disabled }">
        <button
          type="button"
          tabindex="-1"
          :aria-label="t('number.increase')"
          :disabled="disabled || (max !== undefined && Number(modelValue ?? 0) >= max)"
          @pointerdown="startRepeat(1, $event)"
          @pointerup="stopRepeat"
          @pointerleave="stopRepeat"
          @pointercancel="stopRepeat"
        >
          <span class="material-icons" aria-hidden="true">keyboard_arrow_up</span>
        </button>
        <button
          type="button"
          tabindex="-1"
          :aria-label="t('number.decrease')"
          :disabled="disabled || (min !== undefined && Number(modelValue ?? 0) <= min)"
          @pointerdown="startRepeat(-1, $event)"
          @pointerup="stopRepeat"
          @pointerleave="stopRepeat"
          @pointercancel="stopRepeat"
        >
          <span class="material-icons" aria-hidden="true">keyboard_arrow_down</span>
        </button>
      </span>
    </div>
  </div>
</template>

<style scoped>
.featured-numberField {
  position: relative;
}
.featured-numberField .emby-input {
  -moz-appearance: textfield;
  appearance: textfield;
  padding-right: 2rem;
}
.featured-numberField .emby-input::-webkit-inner-spin-button,
.featured-numberField .emby-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.featured-numberZeroLabel {
  color: var(--featured-theme-text-secondary);
  opacity: 0.7;
  pointer-events: none;
  position: absolute;
  right: 2.2rem;
  top: 50%;
  transform: translateY(-50%);
}
/* Sits where Jellyfin's selects draw their arrow, so number fields and selects share one right edge. */
.featured-numberStepper {
  bottom: 2px;
  display: flex;
  flex-direction: column;
  position: absolute;
  right: 4px;
  top: 2px;
  width: 1.7rem;
}
.featured-numberStepper button {
  align-items: center;
  background: none;
  border: 0;
  border-radius: 4px;
  color: var(--featured-theme-text-secondary);
  cursor: pointer;
  display: flex;
  flex: 1 1 50%;
  justify-content: center;
  min-height: 0;
  padding: 0;
}
.featured-numberStepper button:hover:not(:disabled) {
  background: var(--featured-theme-action-hover, rgb(255 255 255 / 8%));
  color: var(--featured-theme-text-primary);
}
.featured-numberStepper button:disabled {
  cursor: default;
  opacity: 0.35;
}
.featured-numberStepper .material-icons {
  font-size: 1.15rem;
  line-height: 1;
}
.featured-numberLabelRow {
  align-items: center;
  display: flex;
  gap: 0.4rem;
  width: fit-content;
}
</style>
