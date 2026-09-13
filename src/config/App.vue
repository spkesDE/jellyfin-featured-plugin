<script setup lang="ts">
import { onBeforeUnmount, onMounted, provide } from 'vue';
import ConfigToolbar from './components/ConfigToolbar.vue';
import { t } from '../i18n';
import { configStoreKey, createConfigStore } from './libs/store';
import AdvancedTab from './tabs/AdvancedTab.vue';
import DisplayTab from './tabs/DisplayTab.vue';
import FiltersTab from './tabs/FiltersTab.vue';
import ManualListsTab from './tabs/ManualListsTab.vue';
import PresetsTab from './tabs/PresetsTab.vue';
import SourcesTab from './tabs/SourcesTab.vue';
import TrailersTab from './tabs/TrailersTab.vue';
import UserProfilesTab from './tabs/UserProfilesTab.vue';

const store = createConfigStore();
provide(configStoreKey, store);
let initialLoadTimer: number | null = null;
const handlePageShow = () => void store.loadConfig();

onMounted(() => {
  initialLoadTimer = window.setTimeout(handlePageShow, 0);
  document.querySelector('#FeaturedConfigPage')?.addEventListener('pageshow', handlePageShow);
});
onBeforeUnmount(() => {
  if (initialLoadTimer) window.clearTimeout(initialLoadTimer);
  document.querySelector('#FeaturedConfigPage')?.removeEventListener('pageshow', handlePageShow);
});
</script>

<template>
  <div class="content-primary">
    <form class="jmp-configForm" @submit.prevent="store.saveConfig">
      <div class="sectionTitleContainer flex align-items-center">
        <h2 class="sectionTitle">{{ t('app.title') }}</h2>
      </div>
      <div class="verticalSection verticalSection-extrabottompadding jmp-intro">
        <p>{{ t('app.intro') }}</p>
      </div>
      <ConfigToolbar />
      <div class="jmp-grid">
        <SourcesTab v-show="store.activeTab.value === 'sources'" />
        <ManualListsTab v-show="store.activeTab.value === 'manual'" />
        <UserProfilesTab v-show="store.activeTab.value === 'users'" />
        <FiltersTab v-show="store.activeTab.value === 'filters'" />
        <DisplayTab v-show="store.activeTab.value === 'display'" />
        <TrailersTab v-show="store.activeTab.value === 'trailers'" />
        <PresetsTab v-show="store.activeTab.value === 'presets'" />
        <AdvancedTab v-show="store.activeTab.value === 'advanced'" />
      </div>
    </form>
  </div>
</template>
