<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type CSSProperties } from 'vue';
import { t } from '../../i18n';
import ConfigHelpTooltip from './ConfigHelpTooltip.vue';
import type { SelectOption } from './ConfigSelect.vue';

const props = defineProps<{
  label: string;
  modelValue: string[];
  options: SelectOption[];
  emptyText?: string;
  helpText?: string;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>();
const root = ref<HTMLElement | null>(null);
const trigger = ref<HTMLButtonElement | null>(null);
const menu = ref<HTMLElement | null>(null);
const open = ref(false);
const query = ref('');
const placement = ref<'up' | 'down'>('down');
const menuStyle = ref<CSSProperties>({ visibility: 'hidden' });

const filteredOptions = computed(() => {
  const term = query.value.trim().toLocaleLowerCase();
  return term ? props.options.filter((option) => option.label.toLocaleLowerCase().includes(term)) : props.options;
});
const selectedLabels = computed(() =>
  props.modelValue
    .map((value) => props.options.find((option) => option.value === value)?.label)
    .filter((value): value is string => Boolean(value))
);
const selectionText = computed(() => {
  if (!selectedLabels.value.length) return t('common.selectOptions');
  if (selectedLabels.value.length <= 2) return selectedLabels.value.join(', ');
  return t('common.selectionSummary', { first: selectedLabels.value[0], count: selectedLabels.value.length - 1 });
});

function toggle(value: string): void {
  const enabled = !props.modelValue.includes(value);
  emit(
    'update:modelValue',
    enabled ? [...new Set([...props.modelValue, value])] : props.modelValue.filter((candidate) => candidate !== value)
  );
}

function close(): void {
  open.value = false;
  query.value = '';
  menuStyle.value = { visibility: 'hidden' };
}

function positionMenu(): void {
  if (!open.value || !trigger.value || !menu.value) return;
  const rect = trigger.value.getBoundingClientRect();
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;
  const margin = 8;
  const gap = 6;
  const width = Math.min(Math.max(rect.width, 352), Math.max(1, viewportWidth - margin * 2));
  const left = Math.min(Math.max(rect.left, margin), Math.max(margin, viewportWidth - margin - width));
  const naturalHeight = Math.min(menu.value.scrollHeight, 420);
  const spaceBelow = Math.max(0, viewportHeight - rect.bottom - gap - margin);
  const spaceAbove = Math.max(0, rect.top - gap - margin);
  const openUp = spaceBelow < Math.min(naturalHeight, 260) && spaceAbove > spaceBelow;
  const availableHeight = openUp ? spaceAbove : spaceBelow;
  const maxHeight = Math.max(80, availableHeight);
  const renderedHeight = Math.min(naturalHeight, maxHeight);
  placement.value = openUp ? 'up' : 'down';
  menuStyle.value = {
    left: `${left}px`,
    maxHeight: `${maxHeight}px`,
    position: 'fixed',
    top: `${openUp ? Math.max(margin, rect.top - gap - renderedHeight) : rect.bottom + gap}px`,
    visibility: 'visible',
    width: `${width}px`,
    zIndex: 10000
  };
}

function toggleOpen(): void {
  if (open.value) {
    close();
    return;
  }
  if (trigger.value) {
    const rect = trigger.value.getBoundingClientRect();
    placement.value = document.documentElement.clientHeight - rect.bottom < 260 && rect.top > 260 ? 'up' : 'down';
  }
  open.value = true;
  void nextTick(() => positionMenu());
}

function handleOutsideClick(event: PointerEvent): void {
  const target = event.target as Node;
  if (open.value && root.value && !root.value.contains(target) && !menu.value?.contains(target)) close();
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') close();
}

function handleViewportChange(): void {
  if (open.value) positionMenu();
}

watch(
  () => [query.value, props.options.length],
  () => {
    if (open.value) void nextTick(() => positionMenu());
  }
);

onMounted(() => {
  document.addEventListener('pointerdown', handleOutsideClick);
  document.addEventListener('keydown', handleKeydown);
  window.addEventListener('resize', handleViewportChange);
  window.addEventListener('scroll', handleViewportChange, true);
});
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleOutsideClick);
  document.removeEventListener('keydown', handleKeydown);
  window.removeEventListener('resize', handleViewportChange);
  window.removeEventListener('scroll', handleViewportChange, true);
});
</script>

<template>
  <div ref="root" class="featured-multiPicker" :class="{ 'is-open': open }">
    <div class="featured-multiPickerLabelRow">
      <label class="selectLabel">{{ label }}</label>
      <ConfigHelpTooltip v-if="helpText" :text="helpText" :label="`${label}: ${helpText}`" />
    </div>
    <button
      ref="trigger"
      type="button"
      class="emby-select emby-select-withcolor featured-multiPickerTrigger"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click="toggleOpen"
    >
      <span :class="{ 'is-placeholder': !selectedLabels.length }">{{ selectionText }}</span>
      <span class="material-icons" aria-hidden="true">{{
        placement === 'up' ? 'keyboard_arrow_up' : 'keyboard_arrow_down'
      }}</span>
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        ref="menu"
        class="featured-multiPickerMenu"
        :class="`opens-${placement}`"
        :style="menuStyle"
        role="listbox"
        aria-multiselectable="true"
      >
        <div class="featured-multiPickerSearchWrap">
          <span class="material-icons" aria-hidden="true">search</span>
          <input
            v-model="query"
            class="featured-multiPickerSearch"
            type="search"
            :placeholder="t('common.search')"
            autofocus
          />
        </div>

        <div v-if="filteredOptions.length" class="featured-multiPickerOptions">
          <button
            v-for="option in filteredOptions"
            :key="option.value"
            type="button"
            class="featured-multiPickerOption"
            :class="{ 'is-selected': modelValue.includes(option.value) }"
            role="option"
            :aria-selected="modelValue.includes(option.value)"
            @click="toggle(option.value)"
          >
            <span class="material-icons featured-multiPickerCheck" aria-hidden="true">
              {{ modelValue.includes(option.value) ? 'check_box' : 'check_box_outline_blank' }}
            </span>
            <span>{{ option.label }}</span>
          </button>
        </div>
        <p v-else class="featured-multiPickerEmpty">{{ emptyText || t('common.noOptions') }}</p>

        <footer class="featured-multiPickerFooter">
          <span>{{ t('common.selectedCount', { count: modelValue.length }) }}</span>
          <div>
            <button
              v-if="modelValue.length"
              type="button"
              class="featured-multiPickerFooterButton"
              @click="emit('update:modelValue', [])"
            >
              {{ t('common.clearSelection') }}
            </button>
            <button type="button" class="featured-multiPickerFooterButton is-primary" @click="close">
              {{ t('common.done') }}
            </button>
          </div>
        </footer>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.featured-multiPicker {
  margin-bottom: 1rem;
  min-width: 0;
  position: relative;
}
.featured-multiPickerLabelRow {
  align-items: center;
  display: flex;
  gap: 0.4rem;
  margin-bottom: 0.35rem;
  width: fit-content;
}
.featured-multiPickerLabelRow > .selectLabel {
  display: block;
}
.featured-multiPickerTrigger {
  align-items: center;
  background: var(--jf-palette-FilledInput-bg, var(--featured-theme-action-hover));
  border: 1px solid var(--jf-palette-FilledInput-borderColor, var(--featured-theme-divider));
  border-radius: var(--featured-theme-radius);
  color: inherit;
  cursor: pointer;
  display: flex;
  gap: 1rem;
  justify-content: space-between;
  min-height: 2.7rem;
  padding: 0.6rem 0.75rem;
  text-align: left;
  width: 100%;
}
.featured-multiPickerTrigger:focus-visible,
.featured-multiPicker.is-open .featured-multiPickerTrigger {
  border-color: var(--featured-theme-secondary);
  outline: 1px solid var(--featured-theme-secondary);
}
.featured-multiPickerTrigger .is-placeholder {
  opacity: 0.58;
}
.featured-multiPickerMenu {
  background: var(--featured-theme-paper);
  border: 1px solid var(--featured-theme-divider);
  border-radius: var(--featured-theme-radius);
  box-shadow: 0 0.85rem 2.4rem rgba(0, 0, 0, 0.55);
  color: var(--featured-theme-text-primary);
  display: flex;
  flex-direction: column;
  min-width: min(22rem, calc(100vw - 1rem));
  overflow: hidden;
  overscroll-behavior: contain;
}
.featured-multiPickerSearchWrap {
  align-items: center;
  border-bottom: 1px solid var(--featured-theme-divider);
  display: flex;
  flex: 0 0 auto;
  gap: 0.45rem;
  padding: 0.65rem 0.75rem;
}
.featured-multiPickerSearchWrap .material-icons {
  font-size: 1.2rem;
  opacity: 0.55;
}
.featured-multiPickerSearch {
  background: transparent;
  border: 0;
  color: inherit;
  min-width: 0;
  outline: 0;
  padding: 0.25rem 0;
  width: 100%;
}
.featured-multiPickerOptions {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 0.35rem;
}
.featured-multiPickerOption {
  align-items: center;
  background: transparent;
  border: 0;
  border-radius: 0.3rem;
  color: inherit;
  cursor: pointer;
  display: flex;
  gap: 0.55rem;
  padding: 0.55rem 0.6rem;
  text-align: left;
  width: 100%;
}
.featured-multiPickerOption:hover,
.featured-multiPickerOption:focus-visible {
  background: var(--featured-theme-action-hover);
  outline: 0;
}
.featured-multiPickerOption.is-selected {
  background: var(--featured-theme-action-focus);
}
.featured-multiPickerCheck {
  color: var(--featured-theme-primary);
  font-size: 1.25rem;
}
.featured-multiPickerEmpty {
  margin: 0;
  opacity: 0.68;
  padding: 1.1rem 0.9rem;
}
.featured-multiPickerFooter {
  align-items: center;
  border-top: 1px solid var(--featured-theme-divider);
  display: flex;
  flex: 0 0 auto;
  font-size: 0.78rem;
  gap: 0.75rem;
  justify-content: space-between;
  padding: 0.55rem 0.7rem;
}
.featured-multiPickerFooter > div {
  display: flex;
  gap: 0.35rem;
}
.featured-multiPickerFooterButton {
  background: transparent;
  border: 0;
  border-radius: 0.25rem;
  color: inherit;
  cursor: pointer;
  padding: 0.4rem 0.55rem;
}
.featured-multiPickerFooterButton:hover {
  background: var(--featured-theme-action-hover);
}
.featured-multiPickerFooterButton.is-primary {
  color: var(--featured-theme-primary);
  font-weight: 700;
}
</style>
