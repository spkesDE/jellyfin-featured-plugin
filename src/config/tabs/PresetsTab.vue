<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { t } from '../../i18n';
import type { FeaturedPreset, PresetScheduleType } from '../../types/config';
import ConfigActionMenu, { type ConfigMenuAction } from '../components/ConfigActionMenu.vue';
import ConfigGrid from '../components/ConfigGrid.vue';
import ConfigListHeader from '../components/ConfigListHeader.vue';
import ConfigPanel from '../components/ConfigPanel.vue';
import ConfigSection from '../components/ConfigSection.vue';
import ConfigDateTime from '../components/ConfigDateTime.vue';
import ConfigNumber from '../components/ConfigNumber.vue';
import ConfigSelect, { type SelectOption } from '../components/ConfigSelect.vue';
import ConfigText from '../components/ConfigText.vue';
import { presetScheduleState, resolveActivePreset, type PresetScheduleState } from '../libs/presetSchedule';
import { useConfigStore } from '../libs/store';

const store = useConfigStore();
const expandedPresetId = ref<string | null>(null);
const feedback = ref('');
watch(store.saveState, (state) => {
  if (state === 'saved') feedback.value = '';
});
const scheduleTypes: { value: PresetScheduleType; label: string }[] = [
  { value: 'one_time', label: t('preset.schedule.oneTime') },
  { value: 'weekly', label: t('preset.schedule.weeklyShort') },
  { value: 'annual', label: t('preset.schedule.annualShort') }
];
const weekdays = [
  { value: 1, label: t('preset.day.mon') },
  { value: 2, label: t('preset.day.tue') },
  { value: 3, label: t('preset.day.wed') },
  { value: 4, label: t('preset.day.thu') },
  { value: 5, label: t('preset.day.fri') },
  { value: 6, label: t('preset.day.sat') },
  { value: 0, label: t('preset.day.sun') }
];
const stateTones: Record<PresetScheduleState, 'success' | 'info' | 'pro' | 'muted'> = {
  active: 'success',
  scheduled: 'info',
  recurring: 'pro',
  expired: 'muted',
  disabled: 'muted'
};

const supportedTimeZones = (() => {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: 'timeZone') => string[] };
  try {
    return intl.supportedValuesOf?.('timeZone') ?? [];
  } catch {
    return [];
  }
})();
/** Time zone options, keeping a saved zone the browser doesn't list (for example plain "UTC"). */
function timeZoneOptions(current: string): SelectOption[] {
  const zones =
    supportedTimeZones.includes(current) || !current ? supportedTimeZones : [current, ...supportedTimeZones];
  return (zones.includes('UTC') ? zones : ['UTC', ...zones]).map((zone) => ({ value: zone, label: zone }));
}

const summary = computed(() =>
  t('preset.summaryCount', {
    count: store.config.Presets.length,
    enabled: store.config.Presets.filter((preset) => preset.Enabled).length
  })
);

const activeNow = computed(() => resolveActivePreset(store.config.Presets));
const activeNowLabel = computed(() => {
  const active = activeNow.value;
  if (!active) return null;
  const name = active.preset.Name || t('preset.defaultName');
  if (!active.endsAt) return t('preset.nowActive', { name });
  // Recurring windows are wall times in the preset's zone, encoded as UTC, so they format in UTC.
  const date = active.endsAt.toLocaleString(document.documentElement.lang || undefined, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: active.endsAtIsWallTime ? 'UTC' : undefined
  });
  return `${t('preset.nowActive', { name })} · ${t('preset.nowUntil', { date })}`;
});

function toggleDay(preset: FeaturedPreset, day: number): void {
  preset.DaysOfWeek = preset.DaysOfWeek.includes(day)
    ? preset.DaysOfWeek.filter((candidate) => candidate !== day)
    : [...preset.DaysOfWeek, day];
}

function stateLabel(preset: FeaturedPreset): string {
  // Without an enabled schedule the preset still works when loaded by hand.
  const state = presetScheduleState(preset);
  return t(state === 'disabled' ? 'preset.state.manual' : (`preset.state.${state}` as Parameters<typeof t>[0]));
}

function scheduleSummary(preset: FeaturedPreset): string {
  if (preset.ScheduleType === 'weekly') {
    const days = weekdays
      .filter((day) => preset.DaysOfWeek.includes(day.value))
      .map((day) => day.label)
      .join(', ');
    return `${t('preset.schedule.weeklyShort')} · ${days || t('preset.summaryNoDays')} · ${preset.StartTime}–${preset.EndTime}`;
  }
  if (preset.ScheduleType === 'annual') {
    return `${t('preset.schedule.annualShort')} · ${preset.AnnualStart}–${preset.AnnualEnd} · ${preset.StartTime}–${preset.EndTime}`;
  }
  if (!preset.StartsAt && !preset.EndsAt) return t('preset.noTimeLimit');
  const starts = preset.StartsAt ? new Date(preset.StartsAt).toLocaleString() : t('preset.summaryOpen');
  const ends = preset.EndsAt ? new Date(preset.EndsAt).toLocaleString() : t('preset.summaryOpen');
  return `${t('preset.schedule.oneTime')} · ${starts}–${ends}`;
}

function contentChips(preset: FeaturedPreset): string[] {
  return [
    t('preset.sourcesSummary', { count: preset.SourceRules.length }),
    t('preset.filtersSummary', { count: preset.GlobalFilters.length }),
    preset.PersonalizationPolicy.Enabled ? t('preset.personalizationOn') : t('preset.personalizationOff'),
    preset.Layout.UseHeroLayout ? t('preset.heroLayout') : t('preset.standardLayout'),
    preset.Trailers.EnableBackgroundTrailers ? t('preset.trailersOn') : t('preset.trailersOff')
  ];
}

function addPreset(): void {
  store.addPreset();
  expandedPresetId.value = store.config.Presets[store.config.Presets.length - 1]?.Id ?? null;
}

function expandDuplicatedPreset(index: number): void {
  expandedPresetId.value = store.config.Presets[index + 1]?.Id ?? null;
}

function presetActions(): ConfigMenuAction[] {
  return [
    { id: 'load', label: t('preset.loadIntoEditor'), icon: 'file_open' },
    { id: 'save', label: t('preset.updateSnapshot'), icon: 'save' },
    { id: 'preview', label: t('feedPreview.previewPreset'), icon: 'preview' },
    { id: 'duplicate', label: t('preset.duplicate'), icon: 'content_copy' },
    { id: 'remove', label: t('preset.remove'), icon: 'delete', danger: true }
  ];
}

function runPresetAction(index: number, action: string): void {
  const preset = store.config.Presets[index];
  if (!preset) return;
  if (action === 'load') loadSnapshot(index);
  else if (action === 'save') saveSnapshot(index);
  else if (action === 'preview') void store.openFeedPreview(preset.Id);
  else if (action === 'duplicate') {
    store.duplicatePreset(index);
    expandDuplicatedPreset(index);
  } else if (action === 'remove') store.removePreset(index);
}

function saveSnapshot(index: number): void {
  store.updatePresetSnapshot(index);
  feedback.value = t('preset.snapshotSaved', { name: store.config.Presets[index].Name });
}

function loadSnapshot(index: number): void {
  store.loadPreset(index);
  feedback.value = t('preset.snapshotLoaded', { name: store.config.Presets[index].Name });
}
</script>

<template>
  <section
    id="featuredPanel-presets"
    class="jmp-section jmp-section-plain"
    role="tabpanel"
    aria-labelledby="featuredTab-presets"
  >
    <ConfigListHeader
      :title="t('preset.title')"
      :help-text="`${t('preset.help')} ${t('preset.defaultHelp')}`"
      :summary="summary"
    >
      <template #actions>
        <button type="button" class="raised button-submit emby-button featured-addSourceButton" @click="addPreset">
          <span class="material-icons" aria-hidden="true">add</span>
          {{ t('preset.add') }}
        </button>
      </template>
    </ConfigListHeader>

    <p v-if="store.config.Presets.length" class="featured-presetNow" :class="{ 'is-active': activeNow }">
      <span class="material-icons" aria-hidden="true">{{ activeNow ? 'play_circle' : 'tune' }}</span>
      {{ activeNowLabel ?? t('preset.nowDefault') }}
    </p>
    <p v-if="feedback" class="featured-presetFeedback" role="status">{{ feedback }}</p>

    <div v-if="store.config.Presets.length" class="featured-configStack">
      <ConfigPanel
        v-for="(preset, index) in store.config.Presets"
        :key="preset.Id"
        v-model:enabled="preset.Enabled"
        :class="{ 'is-expired': presetScheduleState(preset) === 'expired' }"
        :title="preset.Name || t('preset.defaultName')"
        :badge="stateLabel(preset)"
        :badge-tone="stateTones[presetScheduleState(preset)]"
        :enabled-label="t('preset.scheduleEnabled')"
        :dim-when-disabled="false"
        :summary="[scheduleSummary(preset), t('preset.sourcesSummary', { count: preset.SourceRules.length })]"
        :expanded="expandedPresetId === preset.Id"
        @toggle="expandedPresetId = expandedPresetId === preset.Id ? null : preset.Id"
      >
        <template #actions>
          <ConfigActionMenu
            :label="t('preset.moreActions')"
            :actions="presetActions()"
            @select="runPresetAction(index, $event)"
          />
        </template>

        <div class="featured-presetBody">
          <ConfigSection
            :class="{ 'featured-presetScheduleOff': !preset.Enabled }"
            :title="t('preset.scheduleTitle')"
            :help-text="`${t('preset.scheduleHelp')} ${t('preset.enabledHelp')}`"
          >
            <div class="featured-segmented" role="radiogroup" :aria-label="t('preset.scheduleType')">
              <button
                v-for="type in scheduleTypes"
                :key="type.value"
                type="button"
                role="radio"
                :aria-checked="preset.ScheduleType === type.value"
                :class="{ 'is-selected': preset.ScheduleType === type.value }"
                @click="preset.ScheduleType = type.value"
              >
                {{ type.label }}
              </button>
            </div>
            <ConfigGrid v-if="preset.ScheduleType === 'one_time'">
              <ConfigDateTime v-model="preset.StartsAt" :label="t('preset.startsAt')" />
              <ConfigDateTime v-model="preset.EndsAt" :label="t('preset.endsAt')" />
            </ConfigGrid>
            <template v-else>
              <div v-if="preset.ScheduleType === 'weekly'" class="featured-weekdayField">
                <span>{{ t('preset.days') }}</span>
                <div class="featured-weekdays">
                  <button
                    v-for="day in weekdays"
                    :key="day.value"
                    type="button"
                    :class="{ 'is-selected': preset.DaysOfWeek.includes(day.value) }"
                    :aria-pressed="preset.DaysOfWeek.includes(day.value)"
                    @click="toggleDay(preset, day.value)"
                  >
                    {{ day.label }}
                  </button>
                </div>
              </div>
              <ConfigGrid v-else>
                <ConfigText v-model="preset.AnnualStart" :label="t('preset.annualStart')" :placeholder="'12-01'" />
                <ConfigText v-model="preset.AnnualEnd" :label="t('preset.annualEnd')" :placeholder="'12-31'" />
              </ConfigGrid>
              <ConfigGrid>
                <label class="inputContainer">
                  <span class="inputLabel inputLabelUnfocused">{{ t('preset.startTime') }}</span>
                  <input v-model="preset.StartTime" class="emby-input" type="time" />
                </label>
                <label class="inputContainer">
                  <span class="inputLabel inputLabelUnfocused">{{ t('preset.endTime') }}</span>
                  <input v-model="preset.EndTime" class="emby-input" type="time" />
                </label>
              </ConfigGrid>
            </template>
            <ConfigGrid>
              <ConfigSelect
                v-if="preset.ScheduleType !== 'one_time' && supportedTimeZones.length"
                v-model="preset.TimeZoneId"
                :label="t('preset.timeZone')"
                :help-text="t('preset.timeZoneHelp')"
                :options="timeZoneOptions(preset.TimeZoneId)"
              />
              <ConfigText
                v-else-if="preset.ScheduleType !== 'one_time'"
                v-model="preset.TimeZoneId"
                :label="t('preset.timeZone')"
                :placeholder="'Europe/Berlin'"
              />
              <ConfigNumber
                v-model="preset.Priority"
                :label="t('preset.priority')"
                :help-text="t('preset.priorityHelp')"
                :min="-1000"
                :max="1000"
                :step="1"
              />
            </ConfigGrid>
          </ConfigSection>

          <ConfigSection :title="t('preset.contentTitle')" :help-text="t('preset.snapshotHelp')">
            <ConfigText v-model="preset.Name" :label="t('preset.name')" />
            <div class="featured-presetSummary">
              <span v-for="chip in contentChips(preset)" :key="chip">{{ chip }}</span>
            </div>
            <div class="featured-presetSnapshotActions">
              <button
                type="button"
                class="featured-textButton"
                :title="t('preset.loadHelp')"
                @click="loadSnapshot(index)"
              >
                <span class="material-icons" aria-hidden="true">file_open</span>{{ t('preset.loadIntoEditor') }}
              </button>
              <button type="button" class="featured-textButton" @click="saveSnapshot(index)">
                <span class="material-icons" aria-hidden="true">save</span>{{ t('preset.updateSnapshot') }}
              </button>
            </div>
          </ConfigSection>
        </div>
      </ConfigPanel>
    </div>
    <div v-else class="featured-emptySources">
      <span class="material-icons" aria-hidden="true">bookmarks</span>
      <h3>{{ t('preset.emptyTitle') }}</h3>
      <p>{{ t('preset.emptyHelp') }}</p>
    </div>
  </section>
</template>

<style scoped>
.featured-presetNow {
  align-items: center;
  background: var(--featured-config-card-background);
  border: 1px solid var(--featured-theme-divider);
  border-radius: var(--featured-theme-radius);
  display: flex;
  font-size: 0.9rem;
  gap: 0.5rem;
  margin: 0 0 0.75rem;
  padding: 0.55rem 0.8rem;
}
.featured-presetNow .material-icons {
  font-size: 1.2rem;
  opacity: 0.6;
}
.featured-presetNow.is-active .material-icons {
  color: #4cc685;
  opacity: 1;
}
.featured-presetFeedback {
  background: var(--featured-theme-action-focus);
  border-radius: var(--featured-theme-radius);
  color: var(--featured-theme-text-primary);
  font-size: 0.9rem;
  margin: 0 0 0.75rem;
  padding: 0.75rem;
}
.featured-configStack > .is-expired {
  opacity: 0.6;
}
.featured-presetBody {
  display: grid;
  gap: 0 2rem;
  grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
}
.featured-presetBody > :deep(.featured-configSection) {
  border-top: 0;
  margin-top: 0;
  padding-top: 0;
}
.featured-presetBody :deep(.inputContainer) {
  margin-bottom: 0;
}
.featured-presetScheduleOff {
  opacity: 0.55;
}
.featured-segmented {
  border: 1px solid var(--featured-theme-divider);
  border-radius: var(--featured-theme-radius);
  display: inline-flex;
  justify-self: start;
  overflow: hidden;
}
.featured-segmented button {
  background: transparent;
  border: 0;
  color: inherit;
  cursor: pointer;
  font: inherit;
  font-size: 0.9rem;
  padding: 0.45rem 0.9rem;
}
.featured-segmented button + button {
  border-left: 1px solid var(--featured-theme-divider);
}
.featured-segmented button.is-selected {
  background: var(--featured-theme-primary);
  color: var(--featured-theme-primary-contrast);
}
.featured-segmented button:focus-visible {
  outline: 2px solid var(--featured-theme-primary);
  outline-offset: -2px;
}
.featured-weekdayField > span {
  display: block;
  font-size: 0.9rem;
  margin-bottom: 0.4rem;
  opacity: 0.75;
}
.featured-weekdays {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.featured-weekdays button {
  background: var(--featured-theme-action-hover);
  border: 1px solid var(--featured-theme-divider);
  border-radius: var(--featured-theme-radius);
  color: inherit;
  cursor: pointer;
  font: inherit;
  padding: 0.45rem 0.7rem;
}
.featured-weekdays button.is-selected {
  background: var(--featured-theme-primary);
  border-color: var(--featured-theme-primary);
  color: var(--featured-theme-primary-contrast);
}
.featured-weekdays button:focus-visible {
  outline: 2px solid var(--featured-theme-primary);
  outline-offset: 2px;
}
.featured-presetSummary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.featured-presetSummary span {
  background: var(--featured-theme-action-hover);
  border: 1px solid var(--featured-theme-divider);
  border-radius: 999px;
  font-size: 0.8rem;
  padding: 0.2rem 0.6rem;
}
.featured-presetSnapshotActions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.75rem;
}

@media (max-width: 900px) {
  .featured-presetBody {
    grid-template-columns: minmax(0, 1fr);
  }
  .featured-presetBody > :deep(.featured-configSection + .featured-configSection) {
    border-top: 1px solid var(--featured-theme-divider);
    margin-top: 0.9rem;
    padding-top: 0.9rem;
  }
}
</style>
