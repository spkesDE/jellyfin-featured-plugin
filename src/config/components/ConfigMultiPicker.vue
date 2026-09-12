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
const selectedLabels = computed(() => props.modelValue
  .map((value) => props.options.find((option) => option.value === value)?.label)
  .filter((value): value is string => Boolean(value)));
const selectionText = computed(() => {
  if (!selectedLabels.value.length) return t('common.selectOptions');
  if (selectedLabels.value.length <= 2) return selectedLabels.value.join(', ');
  return t('common.selectionSummary', { first: selectedLabels.value[0], count: selectedLabels.value.length - 1 });
});

function toggle(value: string): void {
  const enabled = !props.modelValue.includes(value);
  emit('update:modelValue', enabled
    ? [...new Set([...props.modelValue, value])]
    : props.modelValue.filter((candidate) => candidate !== value));
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

watch(() => [query.value, props.options.length], () => {
  if (open.value) void nextTick(() => positionMenu());
});

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
  <div ref="root" class="ec-multiPicker" :class="{ 'is-open': open }">
    <div class="ec-multiPickerLabelRow">
      <label class="selectLabel">{{ label }}</label>
      <ConfigHelpTooltip v-if="helpText" :text="helpText" :label="`${label}: ${helpText}`" />
    </div>
    <button
      ref="trigger"
      type="button"
      class="emby-select emby-select-withcolor ec-multiPickerTrigger"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click="toggleOpen"
    >
      <span :class="{ 'is-placeholder': !selectedLabels.length }">{{ selectionText }}</span>
      <span class="material-icons" aria-hidden="true">{{ placement === 'up' ? 'keyboard_arrow_up' : 'keyboard_arrow_down' }}</span>
    </button>

    <Teleport to="body">
    <div v-if="open" ref="menu" class="ec-multiPickerMenu" :class="`opens-${placement}`" :style="menuStyle" role="listbox" aria-multiselectable="true">
      <div class="ec-multiPickerSearchWrap">
        <span class="material-icons" aria-hidden="true">search</span>
        <input v-model="query" class="ec-multiPickerSearch" type="search" :placeholder="t('common.search')" autofocus>
      </div>

      <div v-if="filteredOptions.length" class="ec-multiPickerOptions">
        <button
          v-for="option in filteredOptions"
          :key="option.value"
          type="button"
          class="ec-multiPickerOption"
          :class="{ 'is-selected': modelValue.includes(option.value) }"
          role="option"
          :aria-selected="modelValue.includes(option.value)"
          @click="toggle(option.value)"
        >
          <span class="material-icons ec-multiPickerCheck" aria-hidden="true">
            {{ modelValue.includes(option.value) ? 'check_box' : 'check_box_outline_blank' }}
          </span>
          <span>{{ option.label }}</span>
        </button>
      </div>
      <p v-else class="ec-multiPickerEmpty">{{ emptyText || t('common.noOptions') }}</p>

      <footer class="ec-multiPickerFooter">
        <span>{{ t('common.selectedCount', { count: modelValue.length }) }}</span>
        <div>
          <button v-if="modelValue.length" type="button" class="ec-multiPickerFooterButton" @click="emit('update:modelValue', [])">
            {{ t('common.clearSelection') }}
          </button>
          <button type="button" class="ec-multiPickerFooterButton is-primary" @click="close">{{ t('common.done') }}</button>
        </div>
      </footer>
    </div>
    </Teleport>
  </div>
</template>

<style scoped>
.ec-multiPicker { margin-bottom: 1rem; min-width: 0; position: relative; }
.ec-multiPickerLabelRow { align-items: center; display: flex; gap: .4rem; margin-bottom: .35rem; width: fit-content; }
.ec-multiPickerLabelRow > .selectLabel { display: block; }
.ec-multiPickerTrigger { align-items: center; background: rgba(255, 255, 255, .075); border: 1px solid rgba(255, 255, 255, .18); border-radius: .25rem; color: inherit; cursor: pointer; display: flex; gap: 1rem; justify-content: space-between; min-height: 2.7rem; padding: .6rem .75rem; text-align: left; width: 100%; }
.ec-multiPickerTrigger:focus-visible,
.ec-multiPicker.is-open .ec-multiPickerTrigger { border-color: #00a4dc; outline: 1px solid #00a4dc; }
.ec-multiPickerTrigger .is-placeholder { opacity: .58; }
.ec-multiPickerMenu { background: #202020; border: 1px solid rgba(255, 255, 255, .16); border-radius: .45rem; box-shadow: 0 .85rem 2.4rem rgba(0, 0, 0, .55); display: flex; flex-direction: column; min-width: min(22rem, calc(100vw - 1rem)); overflow: hidden; overscroll-behavior: contain; }
.ec-multiPickerSearchWrap { align-items: center; border-bottom: 1px solid rgba(255, 255, 255, .1); display: flex; flex: 0 0 auto; gap: .45rem; padding: .65rem .75rem; }
.ec-multiPickerSearchWrap .material-icons { font-size: 1.2rem; opacity: .55; }
.ec-multiPickerSearch { background: transparent; border: 0; color: inherit; min-width: 0; outline: 0; padding: .25rem 0; width: 100%; }
.ec-multiPickerOptions { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: .35rem; }
.ec-multiPickerOption { align-items: center; background: transparent; border: 0; border-radius: .3rem; color: inherit; cursor: pointer; display: flex; gap: .55rem; padding: .55rem .6rem; text-align: left; width: 100%; }
.ec-multiPickerOption:hover,
.ec-multiPickerOption:focus-visible { background: rgba(255, 255, 255, .08); outline: 0; }
.ec-multiPickerOption.is-selected { background: rgba(0, 164, 220, .12); }
.ec-multiPickerCheck { color: #00a4dc; font-size: 1.25rem; }
.ec-multiPickerEmpty { margin: 0; opacity: .68; padding: 1.1rem .9rem; }
.ec-multiPickerFooter { align-items: center; border-top: 1px solid rgba(255, 255, 255, .1); display: flex; flex: 0 0 auto; font-size: .78rem; gap: .75rem; justify-content: space-between; padding: .55rem .7rem; }
.ec-multiPickerFooter > div { display: flex; gap: .35rem; }
.ec-multiPickerFooterButton { background: transparent; border: 0; border-radius: .25rem; color: inherit; cursor: pointer; padding: .4rem .55rem; }
.ec-multiPickerFooterButton:hover { background: rgba(255, 255, 255, .08); }
.ec-multiPickerFooterButton.is-primary { color: #43c7f4; font-weight: 700; }
</style>
