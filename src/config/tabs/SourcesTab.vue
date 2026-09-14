<script setup lang="ts">
import { ref } from 'vue';
import type { SourceType } from '../../types/config';
import { t } from '../../i18n';
import ConfigCard from '../components/ConfigCard.vue';
import ConfigSelect, { type SelectOption } from '../components/ConfigSelect.vue';
import SourceRuleCard from '../components/SourceRuleCard.vue';
import { useConfigStore } from '../libs/store';

const store = useConfigStore();
const selectedType = ref<SourceType>('LIBRARIES');
const sourceOptions: SelectOption[] = [
  { value: 'LIBRARIES', label: t('source.type.libraries') },
  { value: 'COLLECTIONS', label: t('source.type.collections') },
  { value: 'FAVOURITES', label: t('source.type.favourites') },
  { value: 'TAGS', label: t('source.type.tags') },
  { value: 'PLAYLISTS', label: t('source.type.playlists') },
  { value: 'RECENTLY_ADDED', label: t('source.type.recently_added') },
  { value: 'LATEST_RELEASES', label: t('source.type.latest_releases') },
  { value: 'RANDOM', label: t('source.type.random') },
  { value: 'UNPLAYED', label: t('source.type.unplayed') },
  { value: 'MANUAL_LISTS', label: t('source.type.manual_lists') }
];
</script>

<template>
  <section id="featuredPanel-sources" class="jmp-section jmp-section-plain" role="tabpanel" aria-labelledby="featuredTab-sources">
    <ConfigCard :title="t('source.title')" :help="t('source.help')">
      <template #actions>
        <button type="button" class="raised emby-button ec-secondaryAction ec-feedPreviewAction" @click="store.openFeedPreview()">
          <span class="material-icons" aria-hidden="true">preview</span>
          {{ t('feedPreview.open') }}
        </button>
      </template>
      <div class="ec-addSourceRow">
        <ConfigSelect v-model="selectedType" :label="t('source.newType')" :help-text="t('source.orderHelp')" :options="sourceOptions" />
        <button type="button" class="raised button-submit emby-button ec-addSourceButton" @click="store.addSource(selectedType)">
          <span class="material-icons" aria-hidden="true">add</span>
          {{ t('source.add') }}
        </button>
      </div>
    </ConfigCard>

    <div v-if="store.config.SourceRules.length" class="ec-sourceRules">
      <SourceRuleCard
        v-for="(rule, index) in store.config.SourceRules"
        :key="rule.Id"
        :rule="rule"
        :index="index"
        :count="store.config.SourceRules.length"
      />
    </div>
    <div v-else class="ec-emptySources">
      <span class="material-icons" aria-hidden="true">view_carousel</span>
      <h3>{{ t('source.emptyTitle') }}</h3>
      <p>{{ t('source.emptyHelp') }}</p>
    </div>
  </section>
</template>

<style scoped>
.ec-addSourceRow { align-items: end; display: grid; gap: 1rem; grid-template-columns: minmax(15rem, 1fr) auto; }
.ec-addSourceRow > :deep(.selectContainer) { margin-bottom: 0; }
.ec-sourceRules { display: grid; gap: 1rem; margin-top: 1rem; }
.ec-feedPreviewAction { min-height: 2.35rem; padding: .45rem .75rem; white-space: nowrap; }

@media (max-width: 600px) {
  .ec-addSourceRow { grid-template-columns: 1fr; }
  .ec-feedPreviewAction { width: 100%; }
}
</style>
