<script setup lang="ts">
import { ref } from 'vue';
import Draggable from 'vuedraggable';
import type { SourceType } from '../../types/config';
import { t } from '../../i18n';
import ConfigCard from '../components/ConfigCard.vue';
import ConfigSelect, { type SelectOption } from '../components/ConfigSelect.vue';
import SourceRuleCard from '../components/SourceRuleCard.vue';
import { useConfigStore } from '../libs/store';

const store = useConfigStore();
const selectedType = ref<SourceType>('LIBRARIES');
const expandedSourceId = ref<string | null>(null);
function addSource(): void {
  store.addSource(selectedType.value);
  expandedSourceId.value = store.config.SourceRules[store.config.SourceRules.length - 1]?.Id ?? null;
}
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
  { value: 'RECOMMENDATIONS', label: t('source.type.recommendations') },
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
        <button type="button" class="raised button-submit emby-button ec-addSourceButton" @click="addSource">
          <span class="material-icons" aria-hidden="true">add</span>
          {{ t('source.add') }}
        </button>
      </div>
    </ConfigCard>

    <Draggable v-if="store.config.SourceRules.length" v-model="store.config.SourceRules" item-key="Id" tag="div"
      class="ec-sourceRules" handle=".ec-sourceDragHandle" ghost-class="ec-sourceDragGhost"
      chosen-class="ec-sourceDragChosen" drag-class="ec-sourceDragging" :force-fallback="true"
      :fallback-on-body="true" :fallback-tolerance="3" :animation="160">
      <template #item="{ element: rule, index }">
      <SourceRuleCard
        :rule="rule"
        :index="index"
        :count="store.config.SourceRules.length"
        :expanded="expandedSourceId === rule.Id"
        @toggle="expandedSourceId = expandedSourceId === rule.Id ? null : rule.Id"
      />
      </template>
    </Draggable>
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
.ec-sourceDragGhost,
.ec-sourceDragChosen:not(.ec-sourceDragging) { opacity: .2; }
.ec-sourceDragging { border-color: var(--ec-theme-primary); box-shadow: 0 .8rem 2rem rgba(0, 0, 0, .4); }
.ec-feedPreviewAction { min-height: 2.35rem; padding: .45rem .75rem; white-space: nowrap; }

@media (max-width: 600px) {
  .ec-addSourceRow { grid-template-columns: 1fr; }
  .ec-feedPreviewAction { width: 100%; }
}
</style>
