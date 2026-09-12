<script setup lang="ts">
import { ref } from 'vue';
import type { SourceType } from '../../types/config';
import { t } from '../../i18n';
import ConfigCard from '../components/ConfigCard.vue';
import ConfigCheckbox from '../components/ConfigCheckbox.vue';
import ConfigNumber from '../components/ConfigNumber.vue';
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
      <div class="ec-addSourceRow">
        <ConfigSelect v-model="selectedType" :label="t('source.newType')" :help-text="t('source.orderHelp')" :options="sourceOptions" />
        <button type="button" class="raised button-submit emby-button ec-addSourceButton" @click="store.addSource(selectedType)">
          <span class="material-icons" aria-hidden="true">add</span>
          {{ t('source.add') }}
        </button>
      </div>
    </ConfigCard>

    <ConfigCard :title="t('source.diversityTitle')" :help="t('source.diversityHelp')">
      <div class="ec-diversityGrid">
        <ConfigNumber v-model="store.config.MaximumItemsPerGenre" :label="t('source.maximumPerGenre')"
          :help-text="t('source.maximumPerGenreHelp')" :min="0" :max="100" :step="1" />
        <ConfigNumber v-model="store.config.MaximumItemsPerFranchise" :label="t('source.maximumPerFranchise')"
          :help-text="t('source.maximumPerFranchiseHelp')" :min="0" :max="100" :step="1" />
      </div>
      <ConfigCheckbox v-model="store.config.ExcludeItemsFromSameSeries" :label="t('source.excludeSameSeries')"
        :help-text="t('source.excludeSameSeriesHelp')" />
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
.ec-diversityGrid { display: grid; gap: 1rem; grid-template-columns: repeat(2, minmax(0, 1fr)); }

@media (max-width: 600px) {
  .ec-addSourceRow { grid-template-columns: 1fr; }
  .ec-diversityGrid { grid-template-columns: 1fr; }
}
</style>
