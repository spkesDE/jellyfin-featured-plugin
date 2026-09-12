<script setup lang="ts">
import { nextTick } from 'vue';
import { t } from '../../i18n';
import { useConfigStore } from '../libs/store';
import type { ConfigTab } from '../libs/types';

const store = useConfigStore();
const tabs: Array<{ id: ConfigTab; label: string }> = [
  { id: 'sources', label: t('tab.sources') },
  { id: 'manual', label: t('tab.manual') },
  { id: 'users', label: t('tab.users') },
  { id: 'filters', label: t('tab.filters') },
  { id: 'display', label: t('tab.display') },
  { id: 'advanced', label: t('tab.advanced') }
];

async function handleKeydown(event: KeyboardEvent, tab: ConfigTab): Promise<void> {
  const currentIndex = tabs.findIndex((candidate) => candidate.id === tab);
  let nextIndex = currentIndex;
  if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
  else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
  else if (event.key === 'Home') nextIndex = 0;
  else if (event.key === 'End') nextIndex = tabs.length - 1;
  else return;
  event.preventDefault();
  store.selectTab(tabs[nextIndex].id);
  await nextTick();
  document.querySelector<HTMLButtonElement>(`[data-tab-target="${tabs[nextIndex].id}"]`)?.focus();
}
</script>

<template>
  <div class="jmp-toolbar">
    <div class="jmp-tabBar" role="tablist" :aria-label="t('toolbar.label')">
      <button
        v-for="tab in tabs"
        :id="`featuredTab-${tab.id}`"
        :key="tab.id"
        type="button"
        class="jmp-tabButton"
        :class="{ 'is-active': store.activeTab.value === tab.id }"
        :data-tab-target="tab.id"
        role="tab"
        :aria-controls="`featuredPanel-${tab.id}`"
        :aria-selected="store.activeTab.value === tab.id ? 'true' : 'false'"
        :tabindex="store.activeTab.value === tab.id ? 0 : -1"
        @click="store.selectTab(tab.id)"
        @keydown="handleKeydown($event, tab.id)"
      >
        {{ tab.label }}
      </button>
    </div>

    <button
      type="submit"
      class="raised button-submit emby-button jmp-saveButton"
      :class="{ 'is-dirty': store.saveState.value === 'dirty', 'is-saved': store.saveState.value === 'saved' }"
      :disabled="store.loading.value"
    >
      <span>{{ store.saveState.value === 'saved' ? t('action.saved') : t('action.save') }}</span>
    </button>
  </div>
</template>
