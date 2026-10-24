<script setup lang="ts">
import { t } from '../../i18n';
import ConfigSwitch from './ConfigSwitch.vue';

/**
 * A collapsible settings card: drag handle, title with a one-line summary, an optional enable switch, and an actions
 * slot in the header. Disabled panels stay editable but are dimmed.
 */
defineProps<{
  title: string;
  eyebrow?: string;
  /** Short status pill next to the title. */
  badge?: string;
  badgeTone?: 'success' | 'info' | 'pro' | 'muted';
  summary?: string[];
  expanded?: boolean;
  /** Class the parent's sortable list uses as its drag handle; omit for panels that cannot be reordered. */
  dragHandleClass?: string;
  dragLabel?: string;
  enabledLabel?: string;
  /** Set false when the switch only controls part of the panel, so the rest is not dimmed with it. */
  dimWhenDisabled?: boolean;
}>();
const enabled = defineModel<boolean>('enabled');
defineEmits<{ toggle: [] }>();
</script>

<template>
  <article
    class="featured-configPanel featured-configCard"
    :class="{ 'is-disabled': enabled === false && dimWhenDisabled !== false }"
  >
    <header class="featured-configPanelHeader">
      <button
        v-if="dragHandleClass"
        type="button"
        class="featured-configDragHandle"
        :class="dragHandleClass"
        :title="dragLabel ?? t('common.dragToReorder')"
      >
        <span class="material-icons" aria-hidden="true">drag_indicator</span>
      </button>
      <button type="button" class="featured-configPanelToggle" :aria-expanded="expanded" @click="$emit('toggle')">
        <span class="featured-configPanelHeading">
          <span class="featured-configPanelTitle">{{ title }}</span>
          <span v-if="eyebrow" class="featured-configPanelEyebrow">· {{ eyebrow }}</span>
          <span v-if="badge" class="featured-configPanelBadge" :class="`is-${badgeTone ?? 'muted'}`">{{ badge }}</span>
        </span>
        <span v-if="summary?.length" class="featured-configPanelSummary">
          <span v-for="entry in summary" :key="entry">{{ entry }}</span>
        </span>
      </button>
      <div class="featured-configPanelActions">
        <label v-if="enabled !== undefined" class="featured-configPanelEnabled">
          <span class="featured-configPanelEnabledLabel">{{ enabledLabel ?? t('common.enabled') }}</span>
          <ConfigSwitch v-model="enabled" :label="enabledLabel ?? t('common.enabled')" hide-label />
        </label>
        <slot name="actions" />
        <button
          type="button"
          class="paper-icon-button-light featured-ruleIconButton"
          :aria-expanded="expanded"
          :aria-label="title"
          @click="$emit('toggle')"
        >
          <span class="material-icons featured-configChevron" :class="{ 'is-open': expanded }" aria-hidden="true">
            expand_more
          </span>
        </button>
      </div>
    </header>
    <div v-if="expanded" class="featured-configPanelBody">
      <slot />
    </div>
  </article>
</template>

<style scoped>
.featured-configPanel {
  padding: 0.75rem 0.9rem;
}
.featured-configPanelHeader {
  align-items: center;
  display: flex;
  gap: 0.5rem;
}
.featured-configPanelToggle {
  flex: 1 1 auto;
  background: transparent;
  border: 0;
  color: inherit;
  cursor: pointer;
  display: grid;
  font: inherit;
  gap: 0.15rem;
  min-width: 0;
  padding: 0.15rem 0;
  text-align: left;
}
.featured-configPanelHeading {
  align-items: baseline;
  display: flex;
  gap: 0.4rem;
  min-width: 0;
}
.featured-configPanelTitle {
  font-size: 1.05rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.featured-configPanelBadge {
  align-self: center;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.12rem 0.55rem;
  white-space: nowrap;
}
.featured-configPanelBadge.is-success {
  background: rgb(31 157 90 / 0.18);
  color: #4cc685;
}
.featured-configPanelBadge.is-info {
  background: color-mix(in srgb, var(--featured-theme-primary) 18%, transparent);
  color: var(--featured-theme-primary);
}
.featured-configPanelBadge.is-pro {
  background: rgb(170 92 195 / 0.2);
  color: #c58ad8;
}
.featured-configPanelBadge.is-muted {
  background: var(--featured-theme-action-hover);
  color: var(--featured-theme-text-secondary);
}
.featured-configPanelEyebrow {
  font-size: 0.8rem;
  opacity: 0.6;
  white-space: nowrap;
}
.featured-configPanelSummary {
  display: flex;
  flex-wrap: wrap;
  font-size: 0.8rem;
  gap: 0.1rem 0.6rem;
  opacity: 0.68;
}
.featured-configPanelSummary span + span::before {
  content: '·';
  margin-right: 0.6rem;
}
.featured-configPanelActions {
  align-items: center;
  display: flex;
  gap: 0.15rem;
}
.featured-configPanelEnabled {
  align-items: center;
  cursor: pointer;
  display: flex;
  gap: 0.5rem;
  margin-right: 0.35rem;
}
.featured-configPanelEnabledLabel {
  font-size: 0.85rem;
  opacity: 0.7;
}
.featured-configChevron.is-open {
  transform: rotate(180deg);
}
.featured-configPanelBody {
  border-top: 1px solid var(--featured-theme-divider);
  display: grid;
  margin-top: 0.75rem;
  padding-top: 0.9rem;
}
.featured-configPanel.is-disabled .featured-configPanelToggle,
.featured-configPanel.is-disabled .featured-configPanelBody {
  opacity: 0.6;
}

@media (max-width: 600px) {
  .featured-configPanelHeader {
    flex-wrap: wrap;
  }
  .featured-configPanelActions {
    flex-basis: 100%;
    justify-content: flex-end;
  }
  .featured-configPanelEnabled {
    margin-right: auto;
  }
}
</style>
