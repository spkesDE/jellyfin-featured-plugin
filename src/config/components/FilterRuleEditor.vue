<script setup lang="ts">
import type { FeaturedFilterRule, FilterField, FilterOperator } from '../../types/config';
import { t } from '../../i18n';
import ConfigMultiPicker from './ConfigMultiPicker.vue';
import ConfigNumber from './ConfigNumber.vue';
import ConfigSelect, { type SelectOption } from './ConfigSelect.vue';
import { useConfigStore } from '../libs/store';
import { mediaTypeOptions } from '../../mediaTypes';
import { namedOptions, valueOptions } from '../libs/options';

defineProps<{ filters: FeaturedFilterRule[] }>();
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

function isNumeric(field: FilterField): boolean {
  return ['COMMUNITY_RATING', 'CRITIC_RATING', 'PRODUCTION_YEAR', 'RUNTIME_MINUTES', 'VIDEO_RESOLUTION'].includes(field);
}

function operatorOptions(field: FilterField): SelectOption[] {
  if (isNumeric(field)) return [
    { value: 'GTE', label: t('filter.operator.gte') },
    { value: 'LTE', label: t('filter.operator.lte') }
  ];
  if (['GENRE', 'TAG', 'ACTOR', 'DIRECTOR', 'ORIGINAL_LANGUAGE', 'AUDIO_LANGUAGE'].includes(field)) return [
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
  filter.Values = filter.Field === 'PLAYED'
    ? ['false']
    : filter.Field === 'VIDEO_RESOLUTION' ? ['720'] : [];
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
  if (field === 'COMMUNITY_RATING') return { min: 0, max: 10, step: .1 };
  if (field === 'CRITIC_RATING') return { min: 0, max: 100, step: 1 };
  if (field === 'PRODUCTION_YEAR') return { min: 1880, max: 2200, step: 1 };
  return { min: 0, max: 1000, step: 1 };
}
</script>

<template>
  <div class="ec-filterEditor">
    <div v-for="(filter, index) in filters" :key="filter.Id" class="ec-filterRow">
      <ConfigSelect :model-value="filter.Field" :label="t('filter.fieldLabel')" :options="fieldOptions"
        @update:model-value="setField(filter, $event)" />
      <ConfigSelect :model-value="filter.Operator" :label="t('filter.operatorLabel')"
        :options="operatorOptions(filter.Field)" @update:model-value="setOperator(filter, $event)" />

      <ConfigMultiPicker v-if="filter.Field === 'LIBRARY'" v-model="filter.Values" :label="t('filter.valueLabel')"
        :help-text="t('filter.librariesHelp')" :options="libraryOptions()" />
      <ConfigMultiPicker v-else-if="filter.Field === 'GENRE'" v-model="filter.Values" :label="t('filter.valueLabel')"
        :options="genreOptions()" />
      <ConfigMultiPicker v-else-if="filter.Field === 'TAG'" v-model="filter.Values" :label="t('filter.valueLabel')"
        :options="tagOptions()" />
      <ConfigMultiPicker v-else-if="filter.Field === 'ACTOR'" v-model="filter.Values" :label="t('filter.valueLabel')"
        :help-text="t('filter.metadataMissingHelp')" :options="actorOptions()" />
      <ConfigMultiPicker v-else-if="filter.Field === 'DIRECTOR'" v-model="filter.Values" :label="t('filter.valueLabel')"
        :help-text="t('filter.metadataMissingHelp')" :options="directorOptions()" />
      <ConfigMultiPicker v-else-if="filter.Field === 'ORIGINAL_LANGUAGE'" v-model="filter.Values" :label="t('filter.valueLabel')"
        :help-text="t('filter.metadataMissingHelp')" :options="originalLanguageOptions()" />
      <ConfigMultiPicker v-else-if="filter.Field === 'AUDIO_LANGUAGE'" v-model="filter.Values" :label="t('filter.valueLabel')"
        :help-text="t('filter.metadataMissingHelp')" :options="audioLanguageOptions()" />
      <ConfigMultiPicker v-else-if="filter.Field === 'MEDIA_TYPE'" v-model="filter.Values"
        :label="t('filter.valueLabel')" :options="supportedMediaTypeOptions" />
      <ConfigSelect v-else-if="filter.Field === 'PLAYED'" :model-value="filter.Values[0] || 'false'"
        :label="t('filter.valueLabel')" :options="playedOptions" @update:model-value="filter.Values = [$event]" />
      <ConfigSelect v-else-if="filter.Field === 'VIDEO_RESOLUTION'" :model-value="filter.Values[0] || '720'"
        :label="t('filter.valueLabel')" :options="resolutionOptions" @update:model-value="filter.Values = [$event]" />
      <ConfigNumber v-else :model-value="numericValue(filter)" :label="t('filter.valueLabel')"
        v-bind="numberLimits(filter.Field)" @update:model-value="setNumericValue(filter, $event)" />

      <button type="button" class="paper-icon-button-light ec-ruleIconButton ec-removeFilter"
        :title="t('filter.remove')" @click="store.removeFilter(filters, index)">
        <span class="material-icons" aria-hidden="true">close</span>
      </button>
    </div>

    <button type="button" class="raised emby-button ec-addFilterButton" @click="store.addFilter(filters)">
      <span class="material-icons" aria-hidden="true">add</span>
      {{ t('filter.add') }}
    </button>
  </div>
</template>

<style scoped>
.ec-filterEditor {
  display: grid;
  gap: .75rem;
}

.ec-filterRow {
  align-items: end;
  background: rgba(0, 0, 0, .12);
  border: 1px solid rgba(255, 255, 255, .07);
  border-radius: .65rem;
  display: grid;
  gap: .75rem;
  grid-template-columns: minmax(10rem, 1fr) minmax(10rem, 1fr) minmax(12rem, 1.2fr) auto;
  padding: .75rem;
}

.ec-filterRow> :deep(.selectContainer),
.ec-filterRow> :deep(.inputContainer),
.ec-filterRow> :deep(.ec-multiPicker) {
  margin-bottom: 0;
}

.ec-addFilterButton {
  justify-self: start;
}

@media (max-width: 850px) {
  .ec-filterRow {
    grid-template-columns: 1fr 1fr;
  }

  .ec-removeFilter {
    justify-self: end;
  }
}

@media (max-width: 600px) {
  .ec-filterRow {
    grid-template-columns: 1fr;
  }
}
</style>
