<script setup lang="ts" generic="T extends { Enabled: boolean }">
import Draggable from 'vuedraggable';
import { t } from '../../i18n';
import ConfigHelpTooltip from './ConfigHelpTooltip.vue';
import ConfigSwitch from './ConfigSwitch.vue';

/**
 * An ordered list whose entries can be reordered and switched off, optionally closed by a fixed entry that always
 * comes last. Entries are mutated in place so the list can bind straight to persisted configuration arrays.
 */
const props = defineProps<{
  label: string;
  helpText?: string;
  modelValue: T[];
  itemKey: keyof T & string;
  itemLabel: (item: T) => string;
  /** Dims entries that keep their place but cannot currently play, for example trailers that are switched off. */
  itemInactive?: (item: T) => boolean;
  fixedLabel?: string;
  fixedHint?: string;
}>();

function move(index: number, direction: -1 | 1): void {
  const target = index + direction;
  if (target < 0 || target >= props.modelValue.length) return;
  const [entry] = props.modelValue.splice(index, 1);
  props.modelValue.splice(target, 0, entry);
}
</script>

<template>
  <div class="featured-priorityList">
    <div class="featured-priorityLabelRow featured-configLabelRow">
      <span class="featured-priorityLabel">{{ label }}</span>
      <ConfigHelpTooltip v-if="helpText" :text="helpText" :label="`${label}: ${helpText}`" />
    </div>
    <div class="featured-priorityItems" role="list" :aria-label="label">
      <Draggable
        :list="modelValue"
        :item-key="itemKey"
        tag="div"
        handle=".featured-priorityDragHandle"
        ghost-class="featured-priorityDragGhost"
        :force-fallback="true"
        :fallback-tolerance="3"
        :animation="140"
      >
        <template #item="{ element, index }">
          <div
            class="featured-priorityItem"
            :class="{ 'is-off': !element.Enabled, 'is-inactive': itemInactive?.(element) }"
            role="listitem"
          >
            <button
              type="button"
              class="featured-priorityDragHandle featured-configDragHandle"
              :title="t('common.dragToReorder')"
            >
              <span class="material-icons" aria-hidden="true">drag_indicator</span>
            </button>
            <span class="featured-priorityIndex" aria-hidden="true">{{ index + 1 }}</span>
            <span class="featured-priorityName">{{ itemLabel(element) }}</span>
            <ConfigSwitch v-model="element.Enabled" :label="itemLabel(element)" hide-label />
            <button
              type="button"
              class="paper-icon-button-light featured-priorityMove"
              :disabled="index === 0"
              :title="t('common.moveUp')"
              :aria-label="`${itemLabel(element)}: ${t('common.moveUp')}`"
              @click="move(index, -1)"
            >
              <span class="material-icons" aria-hidden="true">keyboard_arrow_up</span>
            </button>
            <button
              type="button"
              class="paper-icon-button-light featured-priorityMove"
              :disabled="index === modelValue.length - 1"
              :title="t('common.moveDown')"
              :aria-label="`${itemLabel(element)}: ${t('common.moveDown')}`"
              @click="move(index, 1)"
            >
              <span class="material-icons" aria-hidden="true">keyboard_arrow_down</span>
            </button>
          </div>
        </template>
      </Draggable>
      <div v-if="fixedLabel" class="featured-priorityItem is-fixed" role="listitem">
        <span class="featured-priorityDragHandle material-icons" aria-hidden="true">lock</span>
        <span class="featured-priorityIndex" aria-hidden="true"></span>
        <span class="featured-priorityName">{{ fixedLabel }}</span>
        <span v-if="fixedHint" class="featured-priorityHint">{{ fixedHint }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.featured-priorityList {
  display: grid;
  gap: 0.4rem;
}
.featured-priorityLabelRow {
  align-items: center;
  display: flex;
  gap: 0.4rem;
}
.featured-priorityLabel {
  color: var(--featured-theme-text-secondary);
  font-size: 0.9rem;
}
.featured-priorityItems {
  border: 1px solid var(--featured-theme-divider);
  border-radius: var(--featured-theme-radius, 0.5rem);
  overflow: hidden;
}
.featured-priorityItem {
  align-items: center;
  background: var(--featured-config-card-background);
  border-top: 1px solid var(--featured-theme-divider);
  display: flex;
  gap: 0.6rem;
  min-height: 2.75rem;
  padding: 0 0.5rem 0 0.35rem;
}
.featured-priorityItems > div:first-child > .featured-priorityItem:first-child {
  border-top: 0;
}
.featured-priorityIndex {
  font-size: 0.8rem;
  min-width: 1rem;
  opacity: 0.55;
  text-align: right;
}
.featured-priorityName {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.featured-priorityHint {
  font-size: 0.78rem;
  opacity: 0.6;
  white-space: nowrap;
}
.featured-priorityItem.is-off .featured-priorityName,
.featured-priorityItem.is-inactive .featured-priorityName {
  opacity: 0.5;
}
.featured-priorityItem.is-fixed .featured-priorityDragHandle {
  font-size: 1.1rem;
  opacity: 0.55;
  padding: 0.2rem;
}
.featured-priorityMove {
  background: transparent;
  border: 0;
  border-radius: 50%;
  color: inherit;
  cursor: pointer;
  display: inline-flex;
  padding: 0.2rem;
}
.featured-priorityMove:disabled {
  cursor: default;
  opacity: 0.24;
}
.featured-priorityDragGhost {
  opacity: 0.25;
}

@media (max-width: 600px) {
  .featured-priorityItem {
    gap: 0.35rem;
  }
  .featured-priorityName {
    line-height: 1.25;
    white-space: normal;
  }
  /* Narrow rows keep the dimmed name as the only inactive cue so the label stays readable. */
  .featured-priorityHint {
    display: none;
  }
}
</style>
