<script setup lang="ts">
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

function addResult(list: FeaturedManualList, item: FeaturedSearchItem): void {
  store.addManualItem(list, item);
}

function syncItemPositions(list: FeaturedManualList): void {
  list.Items.forEach((item, position) => { item.Position = position; });
}

</script>

<template>
  <section id="featuredPanel-manual" class="jmp-section jmp-section-plain" role="tabpanel"
    aria-labelledby="featuredTab-manual">
    <ConfigCard :title="t('manual.title')" :help="t('manual.help')">
      <button type="button" class="raised button-submit emby-button ec-primaryAction" @click="store.addManualList">
        <span class="material-icons" aria-hidden="true">add</span>{{ t('manual.addList') }}
      </button>
    </ConfigCard>

    <div v-if="store.config.ManualLists.length" class="ec-manualLists">
      <article v-for="(list, listIndex) in store.config.ManualLists" :key="list.Id" class="ec-manualList">
        <div class="ec-manualListHeader">
          <ConfigText v-model="list.Name" />
          <ConfigCheckbox v-model="list.Enabled" :label="t('manual.listEnabled')" />
          <button type="button" class="paper-icon-button-light ec-ruleIconButton ec-removeRule"
            :title="t('manual.removeList')" @click="store.removeManualList(listIndex)">
            <span class="material-icons" aria-hidden="true">delete</span>
          </button>
        </div>

        <details class="ec-manualSchedule">
          <summary>{{ t('manual.schedule') }}</summary>
          <p class="jmp-note">{{ t('manual.scheduleHelp') }}</p>
          <div class="jmp-compactGrid">
            <ConfigDateTime v-model="list.StartsAt" :label="t('manual.startsAt')" />
            <ConfigDateTime v-model="list.EndsAt" :label="t('manual.endsAt')" />
          </div>
        </details>

        <div class="ec-manualSearch">
          <ManualItemAutocomplete :input-id="`manual-search-${list.Id}`"
            :exclude-ids="list.Items.map((item) => item.ItemId)" @select="addResult(list, $event)" />
        </div>

        <Draggable v-if="list.Items.length" v-model="list.Items" item-key="Id" tag="div" class="ec-manualItems"
          handle=".ec-dragHandle" ghost-class="ec-manualDragGhost" chosen-class="ec-manualDragChosen"
          drag-class="ec-manualDragging" fallback-class="ec-manualDragPreview" :force-fallback="true"
          :fallback-on-body="true" :fallback-tolerance="3" :animation="160" @change="syncItemPositions(list)">
          <template #item="{ element: item, index: itemIndex }">
            <article class="ec-manualItem">
              <button type="button" class="ec-dragHandle" :title="t('manual.dragItem')">
                <span class="material-icons" aria-hidden="true">drag_indicator</span>
              </button>
              <div class="ec-manualItemText"><strong>{{ item.Name }}</strong><small>{{ mediaTypeLabel(item.MediaType)
                  }}<template v-if="item.ProductionYear"> · {{ item.ProductionYear }}</template></small></div>
              <details class="ec-itemSchedule">
                <summary :title="t('manual.itemSchedule')"><span class="material-icons"
                    aria-hidden="true">schedule</span>
                </summary>
                <div class="ec-itemSchedulePanel">
                  <ConfigDateTime v-model="item.StartsAt" :label="t('manual.startsAt')" />
                  <ConfigDateTime v-model="item.EndsAt" :label="t('manual.endsAt')" />
                </div>
              </details>
              <div class="ec-manualItemActions">
                <button type="button" class="paper-icon-button-light ec-ruleIconButton" :disabled="itemIndex === 0"
                  :title="t('source.moveUp')" @click="store.moveManualItem(list, itemIndex, itemIndex - 1)"><span
                    class="material-icons" aria-hidden="true">arrow_upward</span></button>
                <button type="button" class="paper-icon-button-light ec-ruleIconButton"
                  :disabled="itemIndex === list.Items.length - 1" :title="t('source.moveDown')"
                  @click="store.moveManualItem(list, itemIndex, itemIndex + 1)"><span class="material-icons"
                    aria-hidden="true">arrow_downward</span></button>
                <button type="button" class="paper-icon-button-light ec-ruleIconButton ec-removeRule"
                  :title="t('manual.removeItem')" @click="store.removeManualItem(list, itemIndex)"><span
                    class="material-icons" aria-hidden="true">close</span></button>
              </div>
            </article>
          </template>
        </Draggable>
        <p v-else class="ec-emptyInline">{{ t('manual.emptyList') }}</p>
      </article>
    </div>
    <div v-else class="ec-emptySources"><span class="material-icons" aria-hidden="true">featured_play_list</span>
      <h3>{{ t('manual.emptyTitle') }}</h3>
      <p>{{ t('manual.emptyHelp') }}</p>
    </div>
  </section>
</template>

<style scoped>
.ec-manualLists {
  display: grid;
  gap: 1rem;
  margin-top: 1rem;
}

.ec-manualList {
  background: rgba(255, 255, 255, .035);
  border: 1px solid rgba(255, 255, 255, .09);
  border-radius: .9rem;
  padding: 1rem;
}

.ec-manualListHeader {
  align-items: center;
  display: grid;
  gap: 1rem;
  grid-template-columns: minmax(15rem, 1fr) auto auto;
}

.ec-manualListHeader> :deep(.inputContainer),
.ec-manualListHeader> :deep(.checkboxContainer) {
  margin-bottom: 0;
}

.ec-manualSchedule {
  border-top: 1px solid rgba(255, 255, 255, .07);
  margin-top: .8rem;
  padding-top: .7rem;
}

.ec-manualSchedule>summary {
  cursor: pointer;
  font-weight: 600;
}

.ec-manualSchedule>.jmp-note {
  margin: .35rem 0 .75rem;
}

.ec-manualSchedule :deep(.inputContainer),
.ec-itemSchedulePanel :deep(.inputContainer) {
  margin-bottom: 0;
}

.ec-manualSearch {
  margin-top: 1rem;
}

.ec-manualItemText {
  display: grid;
  gap: .12rem;
}

.ec-manualItemText small {
  opacity: .65;
}

.ec-manualItems {
  display: grid;
  gap: .45rem;
  margin-top: 1rem;
}

.ec-manualItem {
  align-items: center;
  background: rgba(0, 0, 0, .14);
  border: 1px solid rgba(255, 255, 255, .07);
  border-radius: .55rem;
  display: grid;
  gap: .7rem;
  grid-template-columns: auto minmax(10rem, 1fr) auto auto;
  padding: .6rem .7rem;
  transition: border-color .15s ease, opacity .15s ease;
}

.ec-manualDragGhost,
.ec-manualDragChosen:not(.ec-manualDragPreview) {
  opacity: 0 !important;
}

.ec-manualDragPreview {
  border-color: rgba(0, 164, 220, .65);
  box-shadow: 0 .8rem 2rem rgba(0, 0, 0, .45);
  opacity: .96;
  pointer-events: none;
}

.ec-dragHandle {
  background: transparent;
  border: 0;
  color: inherit;
  cursor: grab;
  opacity: .55;
  padding: .2rem;
}

.ec-dragHandle:active {
  cursor: grabbing;
}

.ec-itemSchedule {
  position: relative;
}

.ec-itemSchedule>summary {
  cursor: pointer;
  list-style: none;
}

.ec-itemSchedulePanel {
  background: #202020;
  border: 1px solid rgba(255, 255, 255, .16);
  border-radius: .45rem;
  box-shadow: 0 .85rem 2.4rem rgba(0, 0, 0, .55);
  display: grid;
  gap: .75rem;
  min-width: min(28rem, 85vw);
  padding: .8rem;
  position: absolute;
  right: 0;
  top: calc(100% + .3rem);
  z-index: 90;
}

.ec-manualItemActions {
  align-items: center;
  display: flex;
  gap: .15rem;
}

.ec-emptyInline {
  margin: 1rem 0 0;
  opacity: .68;
}

@media (max-width: 850px) {
  .ec-manualListHeader {
    grid-template-columns: 1fr auto;
  }

  .ec-manualListHeader> :deep(.inputContainer) {
    grid-column: 1 / -1;
  }
}

@media (max-width: 600px) {
  .ec-manualItem {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }

  .ec-manualItemActions {
    grid-column: 1 / -1;
    justify-content: flex-end;
  }
}
</style>
