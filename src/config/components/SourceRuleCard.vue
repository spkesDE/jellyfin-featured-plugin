<script setup lang="ts">
import { computed } from 'vue';
import type { FeaturedMediaPriorityEntry, FeaturedSourceRule, SourceType } from '../../types/config';
import { t } from '../../i18n';
import ConfigActionMenu, { type ConfigMenuAction } from './ConfigActionMenu.vue';
import ConfigGrid from './ConfigGrid.vue';
import ConfigMultiPicker from './ConfigMultiPicker.vue';
import ConfigNumber from './ConfigNumber.vue';
import ConfigPanel from './ConfigPanel.vue';
import ConfigPriorityList from './ConfigPriorityList.vue';
import ConfigSection from './ConfigSection.vue';
import ConfigSelect, { type SelectOption } from './ConfigSelect.vue';
import ConfigSwitch from './ConfigSwitch.vue';
import FilterRuleEditor from './FilterRuleEditor.vue';
import { useConfigStore } from '../libs/store';
import { namedOptions, valueOptions } from '../libs/options';
import { mediaPriorityLabel, SOURCE_TYPES } from '../libs/sourceTypes';

const props = defineProps<{ rule: FeaturedSourceRule; index: number; count: number; expanded: boolean }>();
defineEmits<{ toggle: [] }>();
const store = useConfigStore();

const qualityOptions: SelectOption[] = [
  { value: 'inherit', label: t('trailers.quality.inherit') },
  { value: 'enabled', label: t('trailers.quality.enabled') },
  { value: 'disabled', label: t('trailers.quality.disabled') }
];
const sourceLabel = (type: SourceType): string => t(SOURCE_TYPES[type].label);
const sourceHelp = (type: SourceType): string => t(SOURCE_TYPES[type].help);
const userOptions = (): SelectOption[] => [
  { value: '', label: t('source.selectUser') },
  ...namedOptions(store.users.value)
];
const restrictedUserOptions = (): SelectOption[] => namedOptions(store.users.value);
const libraryOptions = (): SelectOption[] => namedOptions(store.libraries.value);
const collectionOptions = (): SelectOption[] => namedOptions(store.collections.value);
const playlistOptions = (): SelectOption[] => namedOptions(store.playlists.value);
const manualListOptions = (): SelectOption[] => namedOptions(store.config.ManualLists);
const tagOptions = (): SelectOption[] => valueOptions(store.tags.value);

const trailersPlay = computed(() => store.config.EnableBackgroundTrailers && props.rule.AllowBackgroundTrailers);
/** Trailer rows keep their place while trailers are off; excerpts and Trickplay still cover missing artwork. */
const mediaPriorityInactive = (entry: FeaturedMediaPriorityEntry): boolean =>
  !trailersPlay.value && (entry.Type === 'local_trailer' || entry.Type === 'remote_trailer');

const selection = computed((): { values: string[]; options: SelectOption[] } | null => {
  const rule = props.rule;
  if (rule.Type === 'LIBRARIES') return { values: rule.LibraryIds, options: libraryOptions() };
  if (rule.Type === 'COLLECTIONS') return { values: rule.CollectionIds, options: collectionOptions() };
  if (rule.Type === 'PLAYLISTS') return { values: rule.PlaylistIds, options: playlistOptions() };
  if (rule.Type === 'MANUAL_LISTS') return { values: rule.ManualListIds, options: manualListOptions() };
  if (rule.Type === 'TAGS') return { values: rule.Tags, options: tagOptions() };
  return null;
});
const selectionSummary = computed((): string | null => {
  if (!selection.value?.values.length) return null;
  const { values, options } = selection.value;
  const labels = values.map((value) => options.find((option) => option.value === value)?.label ?? value);
  if (labels.length <= 2) return labels.join(', ');
  return t('common.selectionSummary', { first: labels[0], count: labels.length - 1 });
});
const summary = computed(() =>
  [
    props.rule.Enabled ? null : t('source.statusInactive'),
    t('source.summaryWeight', { weight: props.rule.Weight }),
    selectionSummary.value,
    props.rule.Filters.length === 1
      ? t('source.summaryFiltersOne')
      : props.rule.Filters.length
        ? t('source.summaryFilters', { count: props.rule.Filters.length })
        : null,
    props.rule.IsFallback ? t('source.summaryFallback') : null,
    props.rule.UserIds.length ? t('source.summaryUsers', { count: props.rule.UserIds.length }) : null,
    trailersPlay.value ? null : t('source.summaryTrailersOff')
  ].filter((entry): entry is string => Boolean(entry))
);

const menuActions = computed((): ConfigMenuAction[] => [
  { id: 'up', label: t('source.moveUp'), icon: 'arrow_upward', disabled: props.index === 0 },
  { id: 'down', label: t('source.moveDown'), icon: 'arrow_downward', disabled: props.index === props.count - 1 },
  { id: 'remove', label: t('source.remove'), icon: 'delete', danger: true }
]);
function runAction(id: string): void {
  if (id === 'up') store.moveSource(props.index, -1);
  else if (id === 'down') store.moveSource(props.index, 1);
  else if (id === 'remove') store.removeSource(props.index);
}
</script>

<template>
  <ConfigPanel
    v-model:enabled="rule.Enabled"
    class="featured-sourceRule"
    :title="sourceLabel(rule.Type)"
    :eyebrow="t('source.ruleNumber', { number: index + 1 })"
    :summary="summary"
    :expanded="expanded"
    drag-handle-class="featured-sourceDragHandle"
    :drag-label="t('source.drag')"
    :enabled-label="t('source.statusActive')"
    @toggle="$emit('toggle')"
  >
    <template #actions>
      <ConfigActionMenu :label="t('source.moreActions')" :actions="menuActions" @select="runAction" />
    </template>

    <ConfigSection :title="t('source.section.content')" :help-text="sourceHelp(rule.Type)">
      <ConfigSelect
        v-if="rule.Type === 'FAVOURITES'"
        v-model="rule.EditorUserId"
        :label="t('source.favouritesOwner')"
        :help-text="t('source.editorAccountHelp')"
        :options="userOptions()"
      />
      <ConfigMultiPicker
        v-else-if="rule.Type === 'LIBRARIES'"
        v-model="rule.LibraryIds"
        :label="t('source.chooseLibraries')"
        :options="libraryOptions()"
        :empty-text="t('filter.noLibraries')"
      />
      <ConfigMultiPicker
        v-else-if="rule.Type === 'COLLECTIONS'"
        v-model="rule.CollectionIds"
        :label="t('source.chooseCollections')"
        :help-text="t('source.collectionsHelp')"
        :options="collectionOptions()"
        :empty-text="t('source.noCollections')"
      />
      <ConfigMultiPicker
        v-else-if="rule.Type === 'PLAYLISTS'"
        v-model="rule.PlaylistIds"
        :label="t('source.choosePlaylists')"
        :options="playlistOptions()"
        :empty-text="t('source.noPlaylists')"
      />
      <ConfigMultiPicker
        v-else-if="rule.Type === 'MANUAL_LISTS'"
        v-model="rule.ManualListIds"
        :label="t('source.chooseManualLists')"
        :options="manualListOptions()"
        :empty-text="t('source.noManualLists')"
      />
      <ConfigMultiPicker
        v-else-if="rule.Type === 'TAGS'"
        v-model="rule.Tags"
        :label="t('source.chooseTags')"
        :options="tagOptions()"
        :empty-text="t('source.noTags')"
      />
      <ConfigNumber
        v-else-if="rule.Type === 'RECENTLY_ADDED'"
        v-model="rule.RecentDays"
        :label="t('source.recentDays')"
        :help-text="t('source.recentWindowHelp')"
        :min="1"
        :max="3650"
        :step="1"
      />
      <ConfigNumber
        v-else-if="rule.Type === 'LATEST_RELEASES'"
        v-model="rule.RecentDays"
        :label="t('source.releaseDays')"
        :min="1"
        :max="3650"
        :step="1"
      />
      <FilterRuleEditor
        :filters="rule.Filters"
        :label="t('source.additionalFilters')"
        :help-text="t('source.additionalFiltersHelp')"
      />
    </ConfigSection>

    <ConfigSection :title="t('source.section.distribution')">
      <ConfigGrid :columns="3">
        <ConfigNumber
          v-model="rule.Weight"
          :label="t('source.weight')"
          :help-text="t('source.weightHelp')"
          :min="1"
          :max="100"
          :step="1"
        />
        <ConfigNumber
          v-model="rule.MinimumItems"
          :label="t('source.minimumItems')"
          :help-text="t('source.minimumItemsHelp')"
          :zero-label="t('source.zeroNone')"
          :min="0"
          :max="100"
          :step="1"
        />
        <ConfigNumber
          v-model="rule.MaximumItems"
          :label="t('source.maximumItems')"
          :help-text="t('source.maximumItemsHelp')"
          :zero-label="t('source.zeroUnlimited')"
          :min="0"
          :max="100"
          :step="1"
        />
      </ConfigGrid>
      <ConfigSwitch v-model="rule.IsFallback" :label="t('source.fallback')" :help-text="t('source.fallbackHelp')" />
    </ConfigSection>

    <ConfigSection :title="t('source.section.playback')">
      <p v-if="!store.config.EnableBackgroundTrailers" class="featured-warningNotice">
        <span class="material-icons" aria-hidden="true">warning</span>
        {{ t('source.mediaPriority.trailersGloballyOff') }}
      </p>
      <template v-else>
        <ConfigSwitch
          v-model="rule.AllowBackgroundTrailers"
          :label="t('source.allowBackgroundTrailers')"
          :help-text="t('source.allowBackgroundTrailersHelp')"
        />
        <ConfigSelect
          v-model="rule.YouTubeQualityFilter"
          :label="t('trailers.quality.label')"
          :options="qualityOptions"
          :help-text="t('source.youtubeQualityHelp')"
        />
        <ConfigPriorityList
          v-model="rule.MediaPriority"
          item-key="Type"
          :label="t('source.mediaPriority')"
          :help-text="t('source.mediaPriorityHelp')"
          :item-label="mediaPriorityLabel"
          :item-inactive="mediaPriorityInactive"
          :fixed-label="t('source.mediaPriority.stillImage')"
          :fixed-hint="t('source.mediaPriority.stillImageHint')"
        />
      </template>
    </ConfigSection>

    <ConfigSection :title="t('source.section.visibility')">
      <ConfigMultiPicker
        v-model="rule.UserIds"
        :label="t('source.onlyUsers')"
        :help-text="t('source.onlyUsersHelp')"
        :options="restrictedUserOptions()"
        :empty-text="t('source.noUsers')"
        :placeholder="t('source.allUsers')"
      />
    </ConfigSection>
  </ConfigPanel>
</template>
