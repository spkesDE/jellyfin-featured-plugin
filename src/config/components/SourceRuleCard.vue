<script setup lang="ts">
import { computed } from 'vue';
import type { FeaturedSourceRule, SourceType } from '../../types/config';
import { t, type TranslationKey } from '../../i18n';
import ConfigCheckbox from './ConfigCheckbox.vue';
import ConfigMultiPicker from './ConfigMultiPicker.vue';
import ConfigNumber from './ConfigNumber.vue';
import ConfigSelect, { type SelectOption } from './ConfigSelect.vue';
import FilterRuleEditor from './FilterRuleEditor.vue';
import { useConfigStore } from '../libs/store';
import { namedOptions, valueOptions } from '../libs/options';

const props = defineProps<{ rule: FeaturedSourceRule; index: number; count: number; expanded: boolean }>();
defineEmits<{ toggle: [] }>();
const store = useConfigStore();

const labelKeys: Record<SourceType, TranslationKey> = {
  LIBRARIES: 'source.type.libraries', COLLECTIONS: 'source.type.collections', FAVOURITES: 'source.type.favourites',
  TAGS: 'source.type.tags', PLAYLISTS: 'source.type.playlists', RECENTLY_ADDED: 'source.type.recently_added',
  LATEST_RELEASES: 'source.type.latest_releases', RANDOM: 'source.type.random', UNPLAYED: 'source.type.unplayed',
  MANUAL_LISTS: 'source.type.manual_lists', RECOMMENDATIONS: 'source.type.recommendations'
};
const helpKeys: Record<SourceType, TranslationKey> = {
  LIBRARIES: 'source.help.libraries', COLLECTIONS: 'source.help.collections', FAVOURITES: 'source.help.favourites',
  TAGS: 'source.help.tags', PLAYLISTS: 'source.help.playlists', RECENTLY_ADDED: 'source.help.recently_added',
  LATEST_RELEASES: 'source.help.latest_releases', RANDOM: 'source.help.random', UNPLAYED: 'source.help.unplayed',
  MANUAL_LISTS: 'source.help.manual_lists', RECOMMENDATIONS: 'source.help.recommendations'
};
const sourceLabel = (type: SourceType): string => t(labelKeys[type]);
const sourceHelp = (type: SourceType): string => t(helpKeys[type]);
const userOptions = (): SelectOption[] => [
  { value: '', label: t('source.selectUser') },
  ...namedOptions(store.users.value)
];
const libraryOptions = (): SelectOption[] => namedOptions(store.libraries.value);
const collectionOptions = (): SelectOption[] => namedOptions(store.collections.value);
const playlistOptions = (): SelectOption[] => namedOptions(store.playlists.value);
const manualListOptions = (): SelectOption[] => namedOptions(store.config.ManualLists);
const tagOptions = (): SelectOption[] => valueOptions(store.tags.value);
const selectionCount = computed(() => {
  const rule = props.rule;
  if (rule.Type === 'LIBRARIES') return rule.LibraryIds.length;
  if (rule.Type === 'COLLECTIONS') return rule.CollectionIds.length;
  if (rule.Type === 'PLAYLISTS') return rule.PlaylistIds.length;
  if (rule.Type === 'MANUAL_LISTS') return rule.ManualListIds.length;
  if (rule.Type === 'TAGS') return rule.Tags.length;
  return 0;
});
</script>

<template>
  <article class="ec-sourceRule" :class="{ 'is-disabled': !rule.Enabled }">
    <header class="ec-sourceRuleHeader">
      <button type="button" class="ec-sourceDragHandle" :title="t('source.drag')">
        <span class="material-icons" aria-hidden="true">drag_indicator</span>
      </button>
      <button type="button" class="ec-sourceRuleToggle" :aria-expanded="expanded" @click="$emit('toggle')">
        <div>
        <p class="ec-sourceRuleEyebrow">{{ t('source.ruleNumber', { number: index + 1 }) }}</p>
        <h3>{{ sourceLabel(rule.Type) }}</h3>
        <p class="ec-sourceRuleSummary">
          <span>{{ rule.Enabled ? t('source.statusActive') : t('source.statusInactive') }}</span>
          <span>{{ t('source.summaryWeight', { weight: rule.Weight }) }}</span>
          <span v-if="selectionCount">{{ t('source.summarySelections', { count: selectionCount }) }}</span>
          <span v-if="rule.Filters.length">{{ t('source.summaryFilters', { count: rule.Filters.length }) }}</span>
          <span v-if="rule.IsFallback">{{ t('source.summaryFallback') }}</span>
        </p>
        </div>
        <span class="material-icons ec-sourceChevron" aria-hidden="true">expand_more</span>
      </button>
      <div class="ec-sourceRuleActions">
        <button type="button" class="paper-icon-button-light ec-ruleIconButton" :disabled="index === 0" :title="t('source.moveUp')" @click="store.moveSource(index, -1)">
          <span class="material-icons" aria-hidden="true">arrow_upward</span>
        </button>
        <button type="button" class="paper-icon-button-light ec-ruleIconButton" :disabled="index === count - 1" :title="t('source.moveDown')" @click="store.moveSource(index, 1)">
          <span class="material-icons" aria-hidden="true">arrow_downward</span>
        </button>
        <button type="button" class="paper-icon-button-light ec-ruleIconButton ec-removeRule" :title="t('source.remove')" @click="store.removeSource(index)">
          <span class="material-icons" aria-hidden="true">delete</span>
        </button>
      </div>
    </header>

    <div v-show="expanded" class="ec-sourceRuleBody">
    <p class="jmp-subsectionHelp">{{ sourceHelp(rule.Type) }}</p>
    <div class="ec-sourceRuleBasics">
      <ConfigCheckbox v-model="rule.Enabled" :label="t('source.enabled')" />
      <ConfigNumber v-model="rule.Weight" :label="t('source.weight')" :help-text="t('source.weightHelp')" :min="1" :max="100" :step="1" />
      <ConfigNumber v-model="rule.MinimumItems" :label="t('source.minimumItems')" :help-text="t('source.minimumItemsHelp')" :min="0" :max="100" :step="1" />
      <ConfigNumber v-model="rule.MaximumItems" :label="t('source.maximumItems')" :help-text="t('source.maximumItemsHelp')" :min="0" :max="100" :step="1" />
      <ConfigCheckbox v-model="rule.IsFallback" :label="t('source.fallback')" :help-text="t('source.fallbackHelp')" />
      <ConfigCheckbox v-model="rule.AllowBackgroundTrailers" :label="t('source.allowBackgroundTrailers')" :help-text="t('source.allowBackgroundTrailersHelp')" />
    </div>

    <div v-if="rule.Enabled" class="ec-sourceSettings">
      <ConfigSelect v-if="rule.Type === 'FAVOURITES'" v-model="rule.EditorUserId" :label="t('source.favouritesOwner')" :help-text="t('source.editorAccountHelp')" :options="userOptions()" />
      <ConfigMultiPicker v-else-if="rule.Type === 'LIBRARIES'" v-model="rule.LibraryIds" :label="t('source.chooseLibraries')" :options="libraryOptions()" :empty-text="t('filter.noLibraries')" />
      <ConfigMultiPicker v-else-if="rule.Type === 'COLLECTIONS'" v-model="rule.CollectionIds" :label="t('source.chooseCollections')" :help-text="t('source.collectionsHelp')" :options="collectionOptions()" :empty-text="t('source.noCollections')" />
      <ConfigMultiPicker v-else-if="rule.Type === 'PLAYLISTS'" v-model="rule.PlaylistIds" :label="t('source.choosePlaylists')" :options="playlistOptions()" :empty-text="t('source.noPlaylists')" />
      <ConfigMultiPicker v-else-if="rule.Type === 'MANUAL_LISTS'" v-model="rule.ManualListIds" :label="t('source.chooseManualLists')" :options="manualListOptions()" :empty-text="t('source.noManualLists')" />
      <ConfigMultiPicker v-else-if="rule.Type === 'TAGS'" v-model="rule.Tags" :label="t('source.chooseTags')" :options="tagOptions()" :empty-text="t('source.noTags')" />
      <ConfigNumber v-else-if="rule.Type === 'RECENTLY_ADDED'" v-model="rule.RecentDays" :label="t('source.recentDays')" :help-text="t('source.recentWindowHelp')" :min="1" :max="3650" :step="1" />
      <ConfigNumber v-else-if="rule.Type === 'LATEST_RELEASES'" v-model="rule.RecentDays" :label="t('source.releaseDays')" :min="1" :max="3650" :step="1" />

      <details class="ec-sourceFilters">
        <summary>{{ t('source.additionalFilters', { count: rule.Filters.length }) }}</summary>
        <p class="jmp-note">{{ t('source.additionalFiltersHelp') }}</p>
        <FilterRuleEditor :filters="rule.Filters" />
      </details>
    </div>
    </div>
  </article>
</template>

<style scoped>
.ec-sourceRule { background: var(--ec-config-card-background); border: 1px solid var(--ec-theme-divider); border-radius: .9rem; padding: 1rem 1.1rem 1.15rem; }
.ec-sourceRule.is-disabled { opacity: .72; }
.ec-sourceRuleHeader { align-items: center; display: grid; gap: .55rem; grid-template-columns: auto minmax(0, 1fr) auto; }
.ec-sourceRuleHeader h3 { font-size: 1.08rem; margin: .12rem 0 .25rem; }
.ec-sourceRuleEyebrow { font-size: .7rem; letter-spacing: .08em; margin: 0; opacity: .58; text-transform: uppercase; }
.ec-sourceRuleToggle { align-items: center; background: transparent; border: 0; color: inherit; cursor: pointer; display: flex; justify-content: space-between; min-width: 0; padding: 0; text-align: left; }
.ec-sourceRuleSummary { display: flex; flex-wrap: wrap; font-size: .78rem; gap: .2rem .75rem; margin: 0; opacity: .68; }
.ec-sourceRuleSummary span + span::before { content: '·'; margin-right: .75rem; }
.ec-sourceChevron { transition: transform .16s ease; }
.ec-sourceRuleToggle[aria-expanded="true"] .ec-sourceChevron { transform: rotate(180deg); }
.ec-sourceDragHandle { background: transparent; border: 0; color: inherit; cursor: grab; opacity: .55; padding: .2rem; }
.ec-sourceDragHandle:active { cursor: grabbing; }
.ec-sourceRuleActions { display: flex; gap: .2rem; }
.ec-sourceRuleBody { border-top: 1px solid rgba(255, 255, 255, .07); margin-top: .8rem; padding-top: .8rem; }
.ec-sourceRuleBasics { align-items: center; display: grid; gap: .75rem 1.25rem; grid-template-columns: repeat(2, minmax(10rem, 1fr)); margin-top: 0; }
.ec-sourceRule > .jmp-subsectionHelp { margin-bottom: .4rem; }
.ec-sourceRuleBasics > :deep(.checkboxContainer),
.ec-sourceRuleBasics > :deep(.inputContainer) { margin-bottom: 0; }
.ec-sourceSettings { border-top: 1px solid rgba(255, 255, 255, .07); margin-top: .7rem; padding-top: 1rem; }
.ec-sourceFilters { margin-top: .35rem; padding-top: 0; }
.ec-sourceFilters > summary { cursor: pointer; font-weight: 600; padding: .25rem 0; }
.ec-sourceFilters > .jmp-note { margin: .3rem 0 .65rem; }

@media (max-width: 700px) {
  .ec-sourceRuleBasics { grid-template-columns: 1fr; }
  .ec-sourceRuleHeader { grid-template-columns: auto minmax(0, 1fr); }
  .ec-sourceRuleActions { grid-column: 1 / -1; justify-content: flex-end; }
}
</style>
