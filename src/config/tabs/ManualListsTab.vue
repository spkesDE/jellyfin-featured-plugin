<script setup lang="ts">
import { ref } from 'vue';
import Draggable from 'vuedraggable';
import type { FeaturedManualList } from '../../types/config';
import type { FeaturedSearchItem } from '../../types/featured';
import { t } from '../../i18n';
import { mediaTypeLabel } from '../../mediaTypes';
import ConfigCard from '../components/ConfigCard.vue';
import ConfigCheckbox from '../components/ConfigCheckbox.vue';
import ConfigDateTime from '../components/ConfigDateTime.vue';
import ConfigText from '../components/ConfigText.vue';
import ManualItemAutocomplete from '../components/ManualItemAutocomplete.vue';
import { useConfigStore } from '../libs/store';

const store = useConfigStore();
const expandedManualListId = ref<string | null>(null);

function addManualList(): void {
  store.addManualList();
  expandedManualListId.value = store.config.ManualLists[store.config.ManualLists.length - 1]?.Id ?? null;
}

function addResult(list: FeaturedManualList, item: FeaturedSearchItem): void {
  store.addManualItem(list, item);
}

function syncItemPositions(list: FeaturedManualList): void {
  list.Items.forEach((item, position) => {
    item.Position = position;
  });
}
</script>

<template>
  <section
    id="featuredPanel-manual"
    class="jmp-section jmp-section-plain"
    role="tabpanel"
    aria-labelledby="featuredTab-manual"
  >
    <ConfigCard :title="t('manual.title')" :help="t('manual.help')">
      <button type="button" class="raised button-submit emby-button featured-primaryAction" @click="addManualList">
        <span class="material-icons" aria-hidden="true">add</span>{{ t('manual.addList') }}
      </button>
    </ConfigCard>

    <div v-if="store.config.ManualLists.length" class="featured-manualLists featured-configStack">
      <article
        v-for="(list, listIndex) in store.config.ManualLists"
        :key="list.Id"
        class="featured-manualList featured-configCard featured-configCardPadded"
      >
        <header class="featured-manualListSummary featured-configCardHeader">
          <button
            type="button"
            class="featured-manualListToggle featured-configCardToggle"
            :aria-expanded="expandedManualListId === list.Id"
            @click="expandedManualListId = expandedManualListId === list.Id ? null : list.Id"
          >
            <span>
              <strong>{{ list.Name || t('manual.defaultName') }}</strong>
              <small>
                {{ list.Enabled ? t('source.statusActive') : t('source.statusInactive') }}
                · {{ t('manual.summaryItems', { count: list.Items.length }) }}
                <template v-if="list.StartsAt || list.EndsAt"> · {{ t('manual.summaryScheduled') }}</template>
              </small>
            </span>
            <span class="material-icons featured-manualListChevron featured-configChevron" aria-hidden="true"
              >expand_more</span
            >
          </button>
          <button
            type="button"
            class="paper-icon-button-light featured-ruleIconButton featured-removeRule"
            :title="t('manual.removeList')"
            @click="store.removeManualList(listIndex)"
          >
            <span class="material-icons" aria-hidden="true">delete</span>
          </button>
        </header>

        <div v-show="expandedManualListId === list.Id" class="featured-manualListBody featured-configCardBody">
          <div class="featured-manualListHeader">
            <ConfigText v-model="list.Name" :label="t('manual.listName')" />
            <ConfigCheckbox v-model="list.Enabled" :label="t('manual.listEnabled')" />
          </div>

          <details class="featured-manualSchedule">
            <summary>{{ t('manual.schedule') }}</summary>
            <p class="jmp-note">{{ t('manual.scheduleHelp') }}</p>
            <div class="jmp-compactGrid">
              <ConfigDateTime v-model="list.StartsAt" :label="t('manual.startsAt')" />
              <ConfigDateTime v-model="list.EndsAt" :label="t('manual.endsAt')" />
            </div>
          </details>

          <div class="featured-manualSearch">
            <ManualItemAutocomplete
              :input-id="`manual-search-${list.Id}`"
              :exclude-ids="list.Items.map((item) => item.ItemId)"
              @select="addResult(list, $event)"
            />
          </div>

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
                <div class="featured-manualItemText">
                  <strong>{{ item.Name }}</strong
                  ><small
                    >{{ mediaTypeLabel(item.MediaType)
                    }}<template v-if="item.ProductionYear"> · {{ item.ProductionYear }}</template></small
                  >
                </div>
                <details class="featured-itemSchedule">
                  <summary :title="t('manual.itemSchedule')">
                    <span class="material-icons" aria-hidden="true">schedule</span>
                  </summary>
                  <div class="featured-itemSchedulePanel">
                    <ConfigDateTime v-model="item.StartsAt" :label="t('manual.startsAt')" />
                    <ConfigDateTime v-model="item.EndsAt" :label="t('manual.endsAt')" />
                  </div>
                </details>
                <div class="featured-manualItemActions featured-configActions">
                  <button
                    type="button"
                    class="paper-icon-button-light featured-ruleIconButton"
                    :disabled="itemIndex === 0"
                    :title="t('source.moveUp')"
                    @click="store.moveManualItem(list, itemIndex, itemIndex - 1)"
                  >
                    <span class="material-icons" aria-hidden="true">arrow_upward</span>
                  </button>
                  <button
                    type="button"
                    class="paper-icon-button-light featured-ruleIconButton"
                    :disabled="itemIndex === list.Items.length - 1"
                    :title="t('source.moveDown')"
                    @click="store.moveManualItem(list, itemIndex, itemIndex + 1)"
                  >
                    <span class="material-icons" aria-hidden="true">arrow_downward</span>
                  </button>
                  <button
                    type="button"
                    class="paper-icon-button-light featured-ruleIconButton featured-removeRule"
                    :title="t('manual.removeItem')"
                    @click="store.removeManualItem(list, itemIndex)"
                  >
                    <span class="material-icons" aria-hidden="true">close</span>
                  </button>
                </div>
              </article>
            </template>
          </Draggable>
          <p v-else class="featured-emptyInline">{{ t('manual.emptyList') }}</p>
        </div>
      </article>
    </div>
    <div v-else class="featured-emptySources">
      <span class="material-icons" aria-hidden="true">featured_play_list</span>
      <h3>{{ t('manual.emptyTitle') }}</h3>
      <p>{{ t('manual.emptyHelp') }}</p>
    </div>
  </section>
</template>

<style scoped>
.featured-manualListToggle > span:first-child {
  gap: 0.18rem;
}
.featured-manualListToggle small {
  opacity: 0.68;
}
.featured-manualListToggle[aria-expanded='true'] .featured-manualListChevron {
  transform: rotate(180deg);
}

.featured-manualListHeader {
  align-items: center;
  display: grid;
  gap: 1rem;
  grid-template-columns: minmax(15rem, 1fr) auto;
}

.featured-manualListHeader > :deep(.inputContainer),
.featured-manualListHeader > :deep(.checkboxContainer) {
  margin-bottom: 0;
}

.featured-manualSchedule {
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  margin-top: 0.8rem;
  padding-top: 0.7rem;
}

.featured-manualSchedule > summary {
  cursor: pointer;
  font-weight: 600;
}

.featured-manualSchedule > .jmp-note {
  margin: 0.35rem 0 0.75rem;
}

.featured-manualSchedule :deep(.inputContainer),
.featured-itemSchedulePanel :deep(.inputContainer) {
  margin-bottom: 0;
}

.featured-manualSearch {
  margin-top: 1rem;
}

.featured-manualItemText {
  display: grid;
  gap: 0.12rem;
}

.featured-manualItemText small {
  opacity: 0.65;
}

.featured-manualItems {
  display: grid;
  gap: 0.45rem;
  margin-top: 1rem;
}

.featured-manualItem {
  align-items: center;
  background: rgba(0, 0, 0, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 0.55rem;
  display: grid;
  gap: 0.7rem;
  grid-template-columns: auto minmax(10rem, 1fr) auto auto;
  padding: 0.6rem 0.7rem;
  transition:
    border-color 0.15s ease,
    opacity 0.15s ease;
}

.featured-manualDragGhost,
.featured-manualDragChosen:not(.featured-manualDragPreview) {
  opacity: 0 !important;
}

.featured-manualDragPreview {
  border-color: var(--featured-theme-primary);
  box-shadow: 0 0.8rem 2rem rgba(0, 0, 0, 0.45);
  opacity: 0.96;
  pointer-events: none;
}

.featured-itemSchedule {
  position: relative;
}

.featured-itemSchedule > summary {
  cursor: pointer;
  list-style: none;
}

.featured-itemSchedulePanel {
  background: var(--featured-theme-paper);
  border: 1px solid var(--featured-theme-divider);
  border-radius: var(--featured-theme-radius);
  color: var(--featured-theme-text-primary);
  box-shadow: 0 0.85rem 2.4rem rgba(0, 0, 0, 0.55);
  display: grid;
  gap: 0.75rem;
  min-width: min(28rem, 85vw);
  padding: 0.8rem;
  position: absolute;
  right: 0;
  top: calc(100% + 0.3rem);
  z-index: 90;
}

.featured-emptyInline {
  margin: 1rem 0 0;
  opacity: 0.68;
}

@media (max-width: 850px) {
  .featured-manualListHeader {
    grid-template-columns: 1fr auto;
  }

  .featured-manualListHeader > :deep(.inputContainer) {
    grid-column: 1 / -1;
  }
}

@media (max-width: 600px) {
  .featured-manualItem {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }

  .featured-manualItemActions {
    grid-column: 1 / -1;
    justify-content: flex-end;
  }
}
</style>
