<script setup lang="ts">
import { computed, ref } from 'vue';
import Draggable from 'vuedraggable';
import type { SourceType } from '../../types/config';
import { t } from '../../i18n';
import ConfigActionMenu, { type ConfigMenuAction } from '../components/ConfigActionMenu.vue';
import ConfigListHeader from '../components/ConfigListHeader.vue';
import SourceRuleCard from '../components/SourceRuleCard.vue';
import { useConfigStore } from '../libs/store';
import { SOURCE_TYPE_GROUP_LABELS, SOURCE_TYPES } from '../libs/sourceTypes';

const store = useConfigStore();
const expandedSourceId = ref<string | null>(null);
const sourceTypeActions: ConfigMenuAction[] = (Object.keys(SOURCE_TYPES) as SourceType[]).map((type) => ({
  id: type,
  label: t(SOURCE_TYPES[type].label),
  description: t(SOURCE_TYPES[type].short),
  icon: SOURCE_TYPES[type].icon,
  group: t(SOURCE_TYPE_GROUP_LABELS[SOURCE_TYPES[type].group])
}));
const summary = computed(() =>
  t(store.config.SourceRules.length === 1 ? 'source.summaryCountOne' : 'source.summaryCount', {
    count: store.config.SourceRules.length,
    active: store.config.SourceRules.filter((rule) => rule.Enabled).length
  })
);
function addSource(type: string): void {
  store.addSource(type as SourceType);
  expandedSourceId.value = store.config.SourceRules[store.config.SourceRules.length - 1]?.Id ?? null;
}
</script>

<template>
  <section
    id="featuredPanel-sources"
    class="jmp-section jmp-section-plain"
    role="tabpanel"
    aria-labelledby="featuredTab-sources"
  >
    <ConfigListHeader
      :title="t('source.title')"
      :help-text="`${t('source.help')} ${t('source.orderHelp')}`"
      :summary="summary"
    >
      <template #actions>
        <button
          type="button"
          class="raised emby-button featured-secondaryAction featured-feedPreviewAction"
          @click="store.openFeedPreview()"
        >
          <span class="material-icons" aria-hidden="true">preview</span>
          {{ t('feedPreview.open') }}
        </button>
        <ConfigActionMenu
          :label="t('source.add')"
          :trigger-text="t('source.add')"
          trigger-icon="add"
          :actions="sourceTypeActions"
          @select="addSource"
        />
      </template>
    </ConfigListHeader>

    <Draggable
      v-if="store.config.SourceRules.length"
      v-model="store.config.SourceRules"
      item-key="Id"
      tag="div"
      class="featured-sourceRules featured-configStack"
      handle=".featured-sourceDragHandle"
      ghost-class="featured-sourceDragGhost"
      chosen-class="featured-sourceDragChosen"
      drag-class="featured-sourceDragging"
      :force-fallback="true"
      :fallback-tolerance="3"
      :animation="160"
    >
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
    <div v-else class="featured-emptySources">
      <span class="material-icons" aria-hidden="true">view_carousel</span>
      <h3>{{ t('source.emptyTitle') }}</h3>
      <p>{{ t('source.emptyHelp') }}</p>
    </div>
  </section>
</template>

<style scoped>
.featured-sourceDragGhost,
.featured-sourceDragChosen:not(.featured-sourceDragging) {
  opacity: 0.2;
}
.featured-sourceDragging {
  border-color: var(--featured-theme-primary);
  box-shadow: 0 0.8rem 2rem rgba(0, 0, 0, 0.4);
}
.featured-feedPreviewAction {
  min-height: 2.35rem;
  padding: 0.45rem 0.75rem;
  white-space: nowrap;
}

@media (max-width: 600px) {
  .featured-feedPreviewAction {
    width: 100%;
  }
}
</style>
