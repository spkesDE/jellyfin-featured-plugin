<script setup lang="ts">
import type { FeaturedFilterRule, FilterField, FilterOperator } from '../../types/config';
import { t } from '../../i18n';
import ConfigHelpTooltip from './ConfigHelpTooltip.vue';
import ConfigMultiPicker from './ConfigMultiPicker.vue';
import ConfigNumber from './ConfigNumber.vue';
import ConfigSelect, { type SelectOption } from './ConfigSelect.vue';
import { useConfigStore } from '../libs/store';
import { mediaTypeOptions } from '../../mediaTypes';
import { namedOptions, valueOptions } from '../libs/options';

/** With a label, the add button sits on the label row instead of below the filters. */
/** An empty text turns the empty editor into a placeholder instead of a lone add button. */
defineProps<{ filters: FeaturedFilterRule[]; label?: string; helpText?: string; emptyText?: string }>();
const store = useConfigStore();

const fieldOptions: SelectOption[] = [
  { value: 'LIBRARY', label: t('filter.field.library') },
  { value: 'GENRE', label: t('filter.field.genre') },
  { value: 'TAG', label: t('filter.field.tag') },
  { value: 'MEDIA_TYPE', label: t('filter.field.mediaType') },
  { value: 'PLAYED', label: t('filter.field.played') },
  { value: 'COMMUNITY_RATING', label: t('filter.field.communityRating') },
  { value: 'CRITIC_RATING', label: t('filter.field.criticRating') },
  { value: 'PRODUCTION_YEAR', label: t('filter.field.productionYear') },
  { value: 'RUNTIME_MINUTES', label: t('filter.field.runtime') },
  { value: 'VIDEO_RESOLUTION', label: t('filter.field.videoResolution') },
  { value: 'ACTOR', label: t('filter.field.actor') },
  { value: 'DIRECTOR', label: t('filter.field.director') },
  { value: 'ORIGINAL_LANGUAGE', label: t('filter.field.originalLanguage') },
  { value: 'AUDIO_LANGUAGE', label: t('filter.field.audioLanguage') }
];
const libraryOptions = (): SelectOption[] => namedOptions(store.libraries.value);
const genreOptions = (): SelectOption[] => valueOptions(store.genres.value);
const tagOptions = (): SelectOption[] => valueOptions(store.tags.value);
const actorOptions = (): SelectOption[] => valueOptions(store.actors.value);
const directorOptions = (): SelectOption[] => valueOptions(store.directors.value);
const originalLanguageOptions = (): SelectOption[] => valueOptions(store.originalLanguages.value);
const audioLanguageOptions = (): SelectOption[] => valueOptions(store.audioLanguages.value);
const supportedMediaTypeOptions: SelectOption[] = [
  ...mediaTypeOptions(),
  { value: 'Episode', label: t('filter.value.episodes') }
];
const playedOptions: SelectOption[] = [
  { value: 'false', label: t('filter.value.unplayed') },
  { value: 'true', label: t('filter.value.played') }
];
const resolutionOptions: SelectOption[] = [
  { value: '480', label: '480p' },
  { value: '720', label: '720p' },
  { value: '1080', label: '1080p' },
  { value: '1440', label: '1440p' },
  { value: '2160', label: '2160p (4K)' },
  { value: '4320', label: '4320p (8K)' }
];

/** Value hints that would otherwise sit next to a per-row label, which compact rows do not show. */
function valueHelp(field: FilterField): string | undefined {
  if (field === 'LIBRARY') return t('filter.librariesHelp');
  if (['ACTOR', 'DIRECTOR', 'ORIGINAL_LANGUAGE', 'AUDIO_LANGUAGE'].includes(field))
    return t('filter.metadataMissingHelp');
  return undefined;
}

function isNumeric(field: FilterField): boolean {
  return ['COMMUNITY_RATING', 'CRITIC_RATING', 'PRODUCTION_YEAR', 'RUNTIME_MINUTES', 'VIDEO_RESOLUTION'].includes(
    field
  );
}

function operatorOptions(field: FilterField): SelectOption[] {
  if (isNumeric(field))
    return [
      { value: 'GTE', label: t('filter.operator.gte') },
      { value: 'LTE', label: t('filter.operator.lte') }
    ];
  if (['GENRE', 'TAG', 'ACTOR', 'DIRECTOR', 'ORIGINAL_LANGUAGE', 'AUDIO_LANGUAGE'].includes(field))
    return [
      { value: 'CONTAINS_ANY', label: t('filter.operator.containsAny') },
      { value: 'CONTAINS_ALL', label: t('filter.operator.containsAll') },
      { value: 'NOT_EQUALS', label: t('filter.operator.containsNone') }
    ];
  return [
    { value: 'EQUALS', label: t('filter.operator.equals') },
    { value: 'NOT_EQUALS', label: t('filter.operator.notEquals') }
  ];
}

function setField(filter: FeaturedFilterRule, value: string): void {
  filter.Field = value as FilterField;
  filter.Operator = operatorOptions(filter.Field)[0].value as FilterOperator;
  filter.Values = filter.Field === 'PLAYED' ? ['false'] : filter.Field === 'VIDEO_RESOLUTION' ? ['720'] : [];
}

function setOperator(filter: FeaturedFilterRule, value: string): void {
  filter.Operator = value as FilterOperator;
}

function numericValue(filter: FeaturedFilterRule): number {
  const value = Number(filter.Values[0]);
  return Number.isFinite(value) ? value : 0;
}

function setNumericValue(filter: FeaturedFilterRule, value: number): void {
  filter.Values = [String(value)];
}

function numberLimits(field: FilterField): { min: number; max: number; step: number } {
  if (field === 'COMMUNITY_RATING') return { min: 0, max: 10, step: 0.1 };
  if (field === 'CRITIC_RATING') return { min: 0, max: 100, step: 1 };
  if (field === 'PRODUCTION_YEAR') return { min: 1880, max: 2200, step: 1 };
  return { min: 0, max: 1000, step: 1 };
}
</script>

<template>
  <div class="featured-filterEditor">
    <div v-if="label" class="featured-filterToolbar">
      <div v-if="filters.length || emptyText" class="featured-filterLabel featured-configLabelRow">
        <span>{{ label }}</span>
        <ConfigHelpTooltip v-if="helpText" :text="helpText" :label="`${label}: ${helpText}`" />
      </div>
      <button
        v-if="filters.length || !emptyText"
        type="button"
        class="featured-textButton featured-addFilterButton"
        @click="store.addFilter(filters)"
      >
        <span class="material-icons" aria-hidden="true">add</span>
        {{ t('filter.add') }}
      </button>
    </div>
    <button
      v-if="emptyText && !filters.length"
      type="button"
      class="featured-filterPlaceholder"
      @click="store.addFilter(filters)"
    >
      <span class="material-icons" aria-hidden="true">filter_alt</span>
      <span>{{ emptyText }}</span>
      <span class="featured-filterPlaceholderAction">
        <span class="material-icons" aria-hidden="true">add</span>{{ t('filter.add') }}
      </span>
    </button>
    <div v-if="filters.length" class="featured-filterHead" aria-hidden="true">
      <span>{{ t('filter.fieldLabel') }}</span>
      <span>{{ t('filter.operatorLabel') }}</span>
      <span>{{ t('filter.valueLabel') }}</span>
    </div>
    <div v-for="(filter, index) in filters" :key="filter.Id" class="featured-filterRow">
      <ConfigSelect
        :model-value="filter.Field"
        :label="t('filter.fieldLabel')"
        :options="fieldOptions"
        hide-label
        @update:model-value="setField(filter, $event)"
      />
      <ConfigSelect
        :model-value="filter.Operator"
        :label="t('filter.operatorLabel')"
        :options="operatorOptions(filter.Field)"
        hide-label
        @update:model-value="setOperator(filter, $event)"
      />

      <div class="featured-filterValue">
        <ConfigMultiPicker
          v-if="filter.Field === 'LIBRARY'"
          v-model="filter.Values"
          :label="t('filter.valueLabel')"
          :options="libraryOptions()"
          hide-label
        />
        <ConfigMultiPicker
          v-else-if="filter.Field === 'GENRE'"
          v-model="filter.Values"
          :label="t('filter.valueLabel')"
          :options="genreOptions()"
          hide-label
        />
        <ConfigMultiPicker
          v-else-if="filter.Field === 'TAG'"
          v-model="filter.Values"
          :label="t('filter.valueLabel')"
          :options="tagOptions()"
          hide-label
        />
        <ConfigMultiPicker
          v-else-if="filter.Field === 'ACTOR'"
          v-model="filter.Values"
          :label="t('filter.valueLabel')"
          :options="actorOptions()"
          hide-label
        />
        <ConfigMultiPicker
          v-else-if="filter.Field === 'DIRECTOR'"
          v-model="filter.Values"
          :label="t('filter.valueLabel')"
          :options="directorOptions()"
          hide-label
        />
        <ConfigMultiPicker
          v-else-if="filter.Field === 'ORIGINAL_LANGUAGE'"
          v-model="filter.Values"
          :label="t('filter.valueLabel')"
          :options="originalLanguageOptions()"
          hide-label
        />
        <ConfigMultiPicker
          v-else-if="filter.Field === 'AUDIO_LANGUAGE'"
          v-model="filter.Values"
          :label="t('filter.valueLabel')"
          :options="audioLanguageOptions()"
          hide-label
        />
        <ConfigMultiPicker
          v-else-if="filter.Field === 'MEDIA_TYPE'"
          v-model="filter.Values"
          :label="t('filter.valueLabel')"
          :options="supportedMediaTypeOptions"
          hide-label
        />
        <ConfigSelect
          v-else-if="filter.Field === 'PLAYED'"
          :model-value="filter.Values[0] || 'false'"
          :label="t('filter.valueLabel')"
          :options="playedOptions"
          hide-label
          @update:model-value="filter.Values = [$event]"
        />
        <ConfigSelect
          v-else-if="filter.Field === 'VIDEO_RESOLUTION'"
          :model-value="filter.Values[0] || '720'"
          :label="t('filter.valueLabel')"
          :options="resolutionOptions"
          hide-label
          @update:model-value="filter.Values = [$event]"
        />
        <ConfigNumber
          v-else
          :model-value="numericValue(filter)"
          :label="t('filter.valueLabel')"
          v-bind="numberLimits(filter.Field)"
          hide-label
          @update:model-value="setNumericValue(filter, $event)"
        />
        <ConfigHelpTooltip
          v-if="valueHelp(filter.Field)"
          :text="valueHelp(filter.Field)!"
          :label="`${t('filter.valueLabel')}: ${valueHelp(filter.Field)}`"
        />
      </div>

      <button
        type="button"
        class="paper-icon-button-light featured-ruleIconButton featured-removeFilter"
        :title="t('filter.remove')"
        :aria-label="t('filter.remove')"
        @click="store.removeFilter(filters, index)"
      >
        <span class="material-icons" aria-hidden="true">close</span>
      </button>
    </div>

    <button
      v-if="!label"
      type="button"
      class="featured-textButton featured-addFilterButton"
      @click="store.addFilter(filters)"
    >
      <span class="material-icons" aria-hidden="true">add</span>
      {{ t('filter.add') }}
    </button>
  </div>
</template>

<style scoped>
.featured-filterEditor {
  display: grid;
  gap: 0.4rem;
}
.featured-filterHead,
.featured-filterRow {
  align-items: center;
  display: grid;
  gap: 0.5rem;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.3fr) 2.35rem;
}
.featured-filterHead {
  font-size: 0.8rem;
  opacity: 0.6;
}
.featured-filterRow > :deep(.selectContainer),
.featured-filterValue > :deep(.selectContainer),
.featured-filterValue > :deep(.inputContainer),
.featured-filterValue > :deep(.featured-multiPicker) {
  flex: 1 1 auto;
  margin-bottom: 0;
  min-width: 0;
}
.featured-filterValue {
  align-items: center;
  display: flex;
  gap: 0.75rem;
  min-width: 0;
}
/* Jellyfin's selects, number inputs, and the multi-picker trigger have different natural heights; rows align them. */
.featured-filterRow :deep(.emby-select),
.featured-filterRow :deep(.emby-input),
.featured-filterRow :deep(.featured-multiPickerTrigger) {
  box-sizing: border-box;
  height: 3rem;
  min-height: 0;
  padding-bottom: 0;
  padding-top: 0;
}
.featured-addFilterButton {
  justify-self: end;
}
.featured-filterPlaceholder {
  align-items: center;
  background: transparent;
  border: 1px dashed var(--featured-theme-divider);
  border-radius: var(--featured-theme-radius);
  color: inherit;
  cursor: pointer;
  display: grid;
  font: inherit;
  gap: 0.35rem;
  justify-items: center;
  padding: 1.4rem 1rem;
  text-align: center;
}
.featured-filterPlaceholder:hover,
.featured-filterPlaceholder:focus-visible {
  background: var(--featured-theme-action-hover);
  outline: none;
}
.featured-filterPlaceholder > .material-icons {
  font-size: 1.8rem;
  opacity: 0.45;
}
.featured-filterPlaceholder > span:nth-child(2) {
  font-size: 0.9rem;
  opacity: 0.7;
}
.featured-filterPlaceholderAction {
  align-items: center;
  color: var(--featured-theme-primary);
  display: inline-flex;
  font-weight: 600;
  gap: 0.25rem;
}
.featured-filterPlaceholderAction .material-icons {
  font-size: 1.15rem;
}
.featured-filterToolbar {
  align-items: center;
  display: flex;
  gap: 0.5rem;
}
.featured-filterToolbar > .featured-addFilterButton {
  margin-left: auto;
}
.featured-filterLabel {
  align-items: center;
  display: flex;
  font-size: 0.9rem;
  gap: 0.4rem;
}

@media (max-width: 700px) {
  .featured-filterHead {
    display: none;
  }
  .featured-filterRow {
    border-top: 1px solid var(--featured-theme-divider);
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 2.35rem;
    padding-top: 0.5rem;
  }
  .featured-filterValue {
    grid-column: 1 / 3;
    grid-row: 2;
  }
  .featured-removeFilter {
    grid-column: 3;
    grid-row: 1;
  }
}
</style>
