<script setup lang="ts">
import { computed, ref } from 'vue';
import Draggable from 'vuedraggable';
import type { FeaturedManualList } from '../../types/config';
import type { FeaturedSearchItem } from '../../types/featured';
import { t } from '../../i18n';
import { mediaTypeLabel } from '../../mediaTypes';
import { posterUrl } from '../../slider/images';
import ConfigActionMenu, { type ConfigMenuAction } from '../components/ConfigActionMenu.vue';
import ConfigDateTime from '../components/ConfigDateTime.vue';
import ConfigGrid from '../components/ConfigGrid.vue';
import ConfigListHeader from '../components/ConfigListHeader.vue';
import ConfigPanel from '../components/ConfigPanel.vue';
import ConfigSection from '../components/ConfigSection.vue';
import ConfigText from '../components/ConfigText.vue';
import ManualItemAutocomplete from '../components/ManualItemAutocomplete.vue';
import { useConfigStore } from '../libs/store';

const store = useConfigStore();
const expandedManualListId = ref<string | null>(null);

const summary = computed(() => {
  const items = store.config.ManualLists.reduce((total, list) => total + list.Items.length, 0);
  const lists = store.config.ManualLists.length;
  return lists === 1 ? t('manual.summaryCountOne', { items }) : t('manual.summaryCount', { lists, items });
});

/** Source numbers (as shown in Sources & Mix) that draw from each manual list. */
const sourceNumbersByList = computed(() => {
  const numbers = new Map<string, number[]>();
  store.config.SourceRules.forEach((rule, index) => {
    if (rule.Type !== 'MANUAL_LISTS') return;
    rule.ManualListIds.forEach((id) => numbers.set(id, [...(numbers.get(id) ?? []), index + 1]));
  });
  return numbers;
});

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(document.documentElement.lang || undefined, {
    day: '2-digit',
    month: '2-digit'
  });
}

function scheduleLabel(startsAt: string | null, endsAt: string | null): string | null {
  if (startsAt && endsAt) return `${formatDate(startsAt)} – ${formatDate(endsAt)}`;
  if (startsAt) return t('manual.scheduleFrom', { date: formatDate(startsAt) });
  if (endsAt) return t('manual.scheduleUntil', { date: formatDate(endsAt) });
  return null;
}

function listSummary(list: FeaturedManualList): string[] {
  const sources = sourceNumbersByList.value.get(list.Id);
  return [
    t('manual.summaryItems', { count: list.Items.length }),
    scheduleLabel(list.StartsAt, list.EndsAt) ?? t('manual.scheduleAlways'),
    sources ? t('manual.usedBy', { numbers: sources.join(', ') }) : t('manual.unused')
  ];
}

const listActions = (): ConfigMenuAction[] => [
  { id: 'add-source', label: t('manual.addAsSource'), icon: 'playlist_add' },
  { id: 'remove', label: t('manual.removeList'), icon: 'delete', danger: true }
];

function runListAction(index: number, id: string): void {
  const list = store.config.ManualLists[index];
  if (id === 'add-source' && list) addAsSource(list);
  else if (id === 'remove') store.removeManualList(index);
}

function addManualList(): void {
  store.addManualList();
  expandedManualListId.value = store.config.ManualLists[store.config.ManualLists.length - 1]?.Id ?? null;
}

function addAsSource(list: FeaturedManualList): void {
  store.addSource('MANUAL_LISTS');
  const rule = store.config.SourceRules[store.config.SourceRules.length - 1];
  if (rule) rule.ManualListIds = [list.Id];
}

function addResult(list: FeaturedManualList, item: FeaturedSearchItem): void {
  store.addManualItem(list, item);
}

function syncItemPositions(list: FeaturedManualList): void {
  list.Items.forEach((item, position) => {
    item.Position = position;
  });
}

function hidePoster(event: Event): void {
  (event.target as HTMLImageElement).style.visibility = 'hidden';
}
</script>

<template>
  <section
    id="featuredPanel-manual"
    class="jmp-section jmp-section-plain"
    role="tabpanel"
    aria-labelledby="featuredTab-manual"
  >
    <ConfigListHeader :title="t('manual.title')" :help-text="t('manual.help')" :summary="summary">
      <template #actions>
        <button type="button" class="raised button-submit emby-button featured-addSourceButton" @click="addManualList">
          <span class="material-icons" aria-hidden="true">add</span>{{ t('manual.addList') }}
        </button>
      </template>
    </ConfigListHeader>

    <div v-if="store.config.ManualLists.length" class="featured-manualLists featured-configStack">
      <ConfigPanel
        v-for="(list, listIndex) in store.config.ManualLists"
        :key="list.Id"
        v-model:enabled="list.Enabled"
        :title="list.Name || t('manual.defaultName')"
        :summary="listSummary(list)"
        :expanded="expandedManualListId === list.Id"
        @toggle="expandedManualListId = expandedManualListId === list.Id ? null : list.Id"
      >
        <template #actions>
          <ConfigActionMenu
            :label="t('manual.moreActions')"
            :actions="listActions()"
            @select="runListAction(listIndex, $event)"
          />
        </template>

        <div v-if="!sourceNumbersByList.has(list.Id)" class="featured-manualUnused">
          <span class="material-icons" aria-hidden="true">info</span>
          <span>{{ t('manual.unusedHint') }}</span>
          <button type="button" class="featured-textButton" @click="addAsSource(list)">
            {{ t('manual.addAsSource') }}
          </button>
        </div>

        <ConfigSection :title="t('manual.section.general')">
          <ConfigText v-model="list.Name" :label="t('manual.listName')" />
        </ConfigSection>

        <ConfigSection :title="t('manual.section.schedule')" :help-text="t('manual.scheduleHelp')">
          <ConfigGrid :columns="2">
            <ConfigDateTime v-model="list.StartsAt" :label="t('manual.startsAt')" />
            <ConfigDateTime v-model="list.EndsAt" :label="t('manual.endsAt')" />
          </ConfigGrid>
        </ConfigSection>

        <ConfigSection :title="t('manual.section.items')">
          <ManualItemAutocomplete
            :input-id="`manual-search-${list.Id}`"
            :exclude-ids="list.Items.map((item) => item.ItemId)"
            @select="addResult(list, $event)"
          />

          <Draggable
            v-if="list.Items.length"
            v-model="list.Items"
            item-key="Id"
            tag="div"
            class="featured-manualItems"
            handle=".featured-dragHandle"
            ghost-class="featured-manualDragGhost"
            chosen-class="featured-manualDragChosen"
            drag-class="featured-manualDragging"
            fallback-class="featured-manualDragPreview"
            :force-fallback="true"
            :fallback-tolerance="3"
            :animation="160"
            @change="syncItemPositions(list)"
          >
            <template #item="{ element: item, index: itemIndex }">
              <article class="featured-manualItem">
                <button
                  type="button"
                  class="featured-dragHandle featured-configDragHandle"
                  :title="t('manual.dragItem')"
                >
                  <span class="material-icons" aria-hidden="true">drag_indicator</span>
                </button>
                <span class="featured-manualItemIndex" aria-hidden="true">{{ itemIndex + 1 }}</span>
                <img class="featured-manualItemPoster" :src="posterUrl(item.ItemId)" alt="" @error="hidePoster" />
                <div class="featured-manualItemText">
                  <span>{{ item.Name }}</span>
                  <small
                    >{{ mediaTypeLabel(item.MediaType)
                    }}<template v-if="item.ProductionYear"> · {{ item.ProductionYear }}</template></small
                  >
                </div>
                <span v-if="scheduleLabel(item.StartsAt, item.EndsAt)" class="featured-manualItemSchedule">
                  {{ scheduleLabel(item.StartsAt, item.EndsAt) }}
                </span>
                <details class="featured-itemSchedule">
                  <summary
                    class="featured-manualItemAction"
                    :class="{ 'is-active': item.StartsAt || item.EndsAt }"
                    :title="t('manual.itemSchedule')"
                  >
                    <span class="material-icons" aria-hidden="true">schedule</span>
                  </summary>
                  <div class="featured-itemSchedulePanel">
                    <ConfigDateTime v-model="item.StartsAt" :label="t('manual.startsAt')" />
                    <ConfigDateTime v-model="item.EndsAt" :label="t('manual.endsAt')" />
                  </div>
                </details>
                <button
                  type="button"
                  class="featured-manualItemAction"
                  :disabled="itemIndex === 0"
                  :title="t('common.moveUp')"
                  @click="store.moveManualItem(list, itemIndex, itemIndex - 1)"
                >
                  <span class="material-icons" aria-hidden="true">keyboard_arrow_up</span>
                </button>
                <button
                  type="button"
                  class="featured-manualItemAction"
                  :disabled="itemIndex === list.Items.length - 1"
                  :title="t('common.moveDown')"
                  @click="store.moveManualItem(list, itemIndex, itemIndex + 1)"
                >
                  <span class="material-icons" aria-hidden="true">keyboard_arrow_down</span>
                </button>
                <button
                  type="button"
                  class="featured-manualItemAction featured-removeRule"
                  :title="t('manual.removeItem')"
                  @click="store.removeManualItem(list, itemIndex)"
                >
                  <span class="material-icons" aria-hidden="true">close</span>
                </button>
              </article>
            </template>
          </Draggable>
          <p v-else class="featured-emptyInline">{{ t('manual.emptyList') }}</p>
        </ConfigSection>
      </ConfigPanel>
    </div>
    <div v-else class="featured-emptySources">
      <span class="material-icons" aria-hidden="true">featured_play_list</span>
      <h3>{{ t('manual.emptyTitle') }}</h3>
      <p>{{ t('manual.emptyHelp') }}</p>
    </div>
  </section>
</template>

<style scoped>
.featured-manualUnused {
  align-items: center;
  background: var(--featured-theme-action-hover);
  border-radius: var(--featured-theme-radius);
  display: flex;
  font-size: 0.9rem;
  gap: 0.5rem;
  margin-bottom: 0.9rem;
  padding: 0.35rem 0.4rem 0.35rem 0.7rem;
}
.featured-manualUnused > span:nth-child(2) {
  flex: 1 1 auto;
}
.featured-manualUnused > .material-icons {
  font-size: 1.15rem;
  opacity: 0.7;
}
.featured-manualItems {
  border: 1px solid var(--featured-theme-divider);
  border-radius: var(--featured-theme-radius);
  margin-top: 0.5rem;
}
.featured-manualItem {
  align-items: center;
  background: var(--featured-config-card-background);
  border-top: 1px solid var(--featured-theme-divider);
  display: flex;
  gap: 0.6rem;
  min-height: 3.4rem;
  padding: 0.3rem 0.5rem 0.3rem 0.35rem;
}
.featured-manualItem:first-child {
  border-top: 0;
}
.featured-manualItemIndex {
  font-size: 0.8rem;
  min-width: 1.1rem;
  opacity: 0.55;
  text-align: right;
}
.featured-manualItemPoster {
  aspect-ratio: 2 / 3;
  background: var(--featured-theme-action-hover);
  border-radius: 0.2rem;
  flex: 0 0 auto;
  object-fit: cover;
  width: 1.8rem;
}
.featured-manualItemText {
  display: grid;
  flex: 1 1 auto;
  gap: 0.1rem;
  min-width: 0;
}
.featured-manualItemText > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.featured-manualItemText small {
  opacity: 0.65;
}
.featured-manualItemSchedule {
  background: color-mix(in srgb, var(--featured-theme-primary) 18%, transparent);
  border-radius: 999px;
  color: var(--featured-theme-primary);
  font-size: 0.75rem;
  padding: 0.15rem 0.55rem;
  white-space: nowrap;
}
.featured-manualItemAction {
  align-items: center;
  background: transparent;
  border: 0;
  border-radius: 50%;
  color: inherit;
  cursor: pointer;
  display: inline-flex;
  list-style: none;
  padding: 0.25rem;
}
.featured-manualItemAction::-webkit-details-marker {
  display: none;
}
.featured-manualItemAction .material-icons {
  font-size: 1.25rem;
}
.featured-manualItemAction:disabled {
  cursor: default;
  opacity: 0.24;
}
.featured-manualItemAction.is-active {
  color: var(--featured-theme-primary);
}
.featured-manualDragGhost,
.featured-manualDragChosen:not(.featured-manualDragPreview) {
  opacity: 0 !important;
}
.featured-manualDragPreview {
  border: 1px solid var(--featured-theme-primary);
  box-shadow: 0 0.8rem 2rem rgba(0, 0, 0, 0.45);
  opacity: 0.96;
  pointer-events: none;
}
.featured-itemSchedule {
  position: relative;
}
.featured-itemSchedulePanel {
  background: var(--featured-theme-paper);
  border: 1px solid var(--featured-theme-divider);
  border-radius: var(--featured-theme-radius);
  box-shadow: 0 0.85rem 2.4rem rgba(0, 0, 0, 0.55);
  color: var(--featured-theme-text-primary);
  display: grid;
  gap: 0.75rem;
  min-width: min(28rem, 85vw);
  padding: 0.8rem;
  position: absolute;
  right: 0;
  top: calc(100% + 0.3rem);
  z-index: 90;
}
.featured-itemSchedulePanel :deep(.inputContainer) {
  margin-bottom: 0;
}
.featured-emptyInline {
  margin: 0.5rem 0 0;
  opacity: 0.68;
}

@media (max-width: 600px) {
  .featured-manualItem {
    flex-wrap: wrap;
  }
  .featured-manualItemText {
    flex-basis: calc(100% - 6rem);
  }
  .featured-manualItemIndex {
    display: none;
  }
}
</style>
