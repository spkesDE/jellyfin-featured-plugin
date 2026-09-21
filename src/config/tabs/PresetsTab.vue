<script setup lang="ts">
import { ref } from 'vue';
import { t } from '../../i18n';
import type { FeaturedPreset } from '../../types/config';
import ConfigCard from '../components/ConfigCard.vue';
import ConfigCheckbox from '../components/ConfigCheckbox.vue';
import ConfigDateTime from '../components/ConfigDateTime.vue';
import ConfigNumber from '../components/ConfigNumber.vue';
import ConfigSelect from '../components/ConfigSelect.vue';
import ConfigText from '../components/ConfigText.vue';
import { useConfigStore } from '../libs/store';

const store = useConfigStore();
const expandedPresetId = ref<string | null>(null);
const scheduleTypeOptions = [
  { value: 'one_time', label: t('preset.schedule.oneTime') },
  { value: 'weekly', label: t('preset.schedule.weekly') },
  { value: 'annual', label: t('preset.schedule.annual') }
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

function scheduleState(preset: FeaturedPreset): 'disabled' | 'active' | 'scheduled' | 'expired' | 'recurring' {
  if (!preset.Enabled) return 'disabled';
  if (preset.ScheduleType !== 'one_time') return 'recurring';
  const now = Date.now();
  const starts = preset.StartsAt ? new Date(preset.StartsAt).getTime() : Number.NEGATIVE_INFINITY;
  const ends = preset.EndsAt ? new Date(preset.EndsAt).getTime() : Number.POSITIVE_INFINITY;
  if (now < starts) return 'scheduled';
  if (now >= ends) return 'expired';
  return 'active';
}

function toggleDay(preset: FeaturedPreset, day: number): void {
  preset.DaysOfWeek = preset.DaysOfWeek.includes(day)
    ? preset.DaysOfWeek.filter((candidate) => candidate !== day)
    : [...preset.DaysOfWeek, day];
}

function stateLabel(preset: FeaturedPreset): string {
  return t(`preset.state.${scheduleState(preset)}` as Parameters<typeof t>[0]);
}

function scheduleSummary(preset: FeaturedPreset): string {
  if (preset.ScheduleType === 'weekly') {
    const days = weekdays.filter((day) => preset.DaysOfWeek.includes(day.value)).map((day) => day.label).join(', ');
    return `${t('preset.schedule.weekly')} · ${days || t('preset.summaryNoDays')} · ${preset.StartTime}–${preset.EndTime}`;
  }
  if (preset.ScheduleType === 'annual') {
    return `${t('preset.schedule.annual')} · ${preset.AnnualStart}–${preset.AnnualEnd} · ${preset.StartTime}–${preset.EndTime}`;
  }
  const starts = preset.StartsAt ? new Date(preset.StartsAt).toLocaleString() : t('preset.summaryOpen');
  const ends = preset.EndsAt ? new Date(preset.EndsAt).toLocaleString() : t('preset.summaryOpen');
  return `${t('preset.schedule.oneTime')} · ${starts}–${ends}`;
}

function addPreset(): void {
  store.addPreset();
  expandedPresetId.value = store.config.Presets[store.config.Presets.length - 1]?.Id ?? null;
}

function expandDuplicatedPreset(index: number): void {
  expandedPresetId.value = store.config.Presets[index + 1]?.Id ?? null;
}

function syncExpandedPreset(event: Event, presetId: string): void {
  const details = event.currentTarget as HTMLDetailsElement;
  if (details.open) expandedPresetId.value = presetId;
  else if (expandedPresetId.value === presetId) expandedPresetId.value = null;
}
</script>

<template>
  <section id="featuredPanel-presets" class="jmp-section jmp-section-plain" role="tabpanel" aria-labelledby="featuredTab-presets">
    <ConfigCard :title="t('preset.title')" :help="t('preset.help')">
      <div class="ec-presetIntro">
        <div>
          <strong>{{ t('preset.defaultTitle') }}</strong>
          <p>{{ t('preset.defaultHelp') }}</p>
        </div>
        <button type="button" class="raised button-submit emby-button ec-primaryAction" @click="addPreset">
          <span class="material-icons" aria-hidden="true">add</span>
          {{ t('preset.add') }}
        </button>
      </div>
    </ConfigCard>

    <div v-if="store.config.Presets.length" class="ec-presetList">
      <details
        v-for="(preset, index) in store.config.Presets"
        :key="preset.Id"
        class="ec-presetCard"
        :open="expandedPresetId === preset.Id"
        @toggle="syncExpandedPreset($event, preset.Id)"
      >
        <summary class="ec-presetCardSummary">
          <span class="ec-presetCardCopy">
            <span class="ec-presetTitleRow">
              <strong>{{ preset.Name || t('preset.defaultName') }}</strong>
              <span class="jmp-badge" :class="{ 'jmp-badge-muted': scheduleState(preset) !== 'active' }">{{ stateLabel(preset) }}</span>
            </span>
            <small>{{ t('preset.summaryPriority', { value: preset.Priority }) }} · {{ scheduleSummary(preset) }}</small>
            <span class="ec-presetSummary" :aria-label="t('preset.snapshotSummary')">
              <span>{{ t('preset.sourcesSummary', { count: preset.SourceRules.length }) }}</span>
              <span>{{ t('preset.filtersSummary', { count: preset.GlobalFilters.length }) }}</span>
              <span>{{ preset.PersonalizationPolicy.Enabled ? t('preset.personalizationOn') : t('preset.personalizationOff') }}</span>
              <span>{{ preset.Layout.UseHeroLayout ? t('preset.heroLayout') : t('preset.standardLayout') }}</span>
              <span>{{ preset.Trailers.EnableBackgroundTrailers ? t('preset.trailersOn') : t('preset.trailersOff') }}</span>
            </span>
          </span>
          <span class="material-icons ec-presetChevron" aria-hidden="true">expand_more</span>
        </summary>
        <div class="ec-presetCardBody">
        <div class="ec-presetGrid">
          <ConfigText v-model="preset.Name" :label="t('preset.name')" />
          <ConfigNumber v-model="preset.Priority" :label="t('preset.priority')" :help-text="t('preset.priorityHelp')" :min="-1000" :max="1000" :step="1" />
          <ConfigSelect v-model="preset.ScheduleType" :label="t('preset.scheduleType')" :options="scheduleTypeOptions" />
        </div>
        <div v-if="preset.ScheduleType === 'one_time'" class="ec-presetScheduleGrid">
          <ConfigDateTime v-model="preset.StartsAt" :label="t('preset.startsAt')" />
          <ConfigDateTime v-model="preset.EndsAt" :label="t('preset.endsAt')" />
        </div>
        <div v-else class="ec-recurringSchedule">
          <ConfigText v-model="preset.TimeZoneId" :label="t('preset.timeZone')" :placeholder="'Europe/Berlin'" />
          <div v-if="preset.ScheduleType === 'weekly'" class="ec-weekdayField">
            <span>{{ t('preset.days') }}</span>
            <div class="ec-weekdays">
              <button v-for="day in weekdays" :key="day.value" type="button" :class="{ 'is-selected': preset.DaysOfWeek.includes(day.value) }" @click="toggleDay(preset, day.value)">
                {{ day.label }}
              </button>
            </div>
          </div>
          <template v-else>
            <ConfigText v-model="preset.AnnualStart" :label="t('preset.annualStart')" :placeholder="'12-01'" />
            <ConfigText v-model="preset.AnnualEnd" :label="t('preset.annualEnd')" :placeholder="'12-31'" />
          </template>
          <label class="inputContainer">
            <span class="inputLabel inputLabelUnfocused">{{ t('preset.startTime') }}</span>
            <input v-model="preset.StartTime" class="emby-input" type="time" />
          </label>
          <label class="inputContainer">
            <span class="inputLabel inputLabelUnfocused">{{ t('preset.endTime') }}</span>
            <input v-model="preset.EndTime" class="emby-input" type="time" />
          </label>
        </div>
        <p v-if="preset.ScheduleType !== 'one_time'" class="ec-presetTimezoneHelp">{{ t('preset.timeZoneHelp') }}</p>
        <ConfigCheckbox v-model="preset.Enabled" :label="t('preset.enabled')" :help-text="t('preset.enabledHelp')" />

        <p class="ec-presetSnapshotHelp">{{ t('preset.snapshotHelp') }}</p>
        <div class="ec-presetActions">
          <button type="button" class="raised emby-button ec-secondaryAction" @click="store.openFeedPreview(preset.Id)">
            <span class="material-icons" aria-hidden="true">preview</span>
            {{ t('feedPreview.previewPreset') }}
          </button>
          <button type="button" class="raised emby-button ec-secondaryAction" @click="store.updatePresetSnapshot(index)">
            <span class="material-icons" aria-hidden="true">sync</span>
            {{ t('preset.updateSnapshot') }}
          </button>
          <button type="button" class="raised emby-button ec-secondaryAction" @click="store.duplicatePreset(index); expandDuplicatedPreset(index)">
            <span class="material-icons" aria-hidden="true">content_copy</span>
            {{ t('preset.duplicate') }}
          </button>
          <button type="button" class="raised emby-button ec-secondaryAction ec-presetRemove" @click="store.removePreset(index)">
            <span class="material-icons" aria-hidden="true">delete</span>
            {{ t('preset.remove') }}
          </button>
        </div>
        </div>
      </details>
    </div>

    <div v-else class="ec-emptySources">
      <span class="material-icons" aria-hidden="true">event</span>
      <h3>{{ t('preset.emptyTitle') }}</h3>
      <p>{{ t('preset.emptyHelp') }}</p>
    </div>
  </section>
</template>

<style scoped>
.ec-presetIntro { align-items: center; display: flex; gap: 1rem; justify-content: space-between; }
.ec-presetIntro p { margin: .25rem 0 0; opacity: .75; }
.ec-presetList { display: grid; gap: 1rem; }
.ec-presetCard { background: var(--ec-config-card-background); border: 1px solid var(--ec-theme-divider); border-radius: .9rem; overflow: hidden; }
.ec-presetCardSummary { align-items: center; cursor: pointer; display: grid; gap: .75rem; grid-template-columns: minmax(0, 1fr) auto; list-style: none; padding: 1rem; }
.ec-presetCardSummary::-webkit-details-marker { display: none; }
.ec-presetCardCopy { display: grid; gap: .35rem; min-width: 0; }
.ec-presetTitleRow { align-items: center; display: flex; flex-wrap: wrap; gap: .55rem; }
.ec-presetTitleRow strong { font-size: 1.08rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ec-presetCardCopy > small { opacity: .68; overflow-wrap: anywhere; }
.ec-presetChevron { transition: transform .16s ease; }
.ec-presetCard[open] .ec-presetChevron { transform: rotate(180deg); }
.ec-presetCardBody { border-top: 1px solid var(--ec-theme-divider); padding: 1rem; }
.ec-presetGrid { display: grid; gap: 1rem; grid-template-columns: 2fr 1fr 1.5fr; }
.ec-presetScheduleGrid { display: grid; gap: 1rem; grid-template-columns: 1fr 1fr; }
.ec-recurringSchedule { display: grid; gap: 1rem; grid-template-columns: repeat(4, minmax(0, 1fr)); }
.ec-weekdayField { grid-column: span 3; }
.ec-weekdayField>span { display: block; margin-bottom: .4rem; }
.ec-weekdays { display: flex; flex-wrap: wrap; gap: .4rem; }
.ec-weekdays button { background: var(--ec-theme-action-hover); border: 1px solid var(--ec-theme-divider); border-radius: 999px; color: inherit; cursor: pointer; padding: .45rem .7rem; }
.ec-weekdays button.is-selected { background: var(--ec-theme-primary); border-color: var(--ec-theme-primary); color: var(--ec-theme-primary-contrast); }
.ec-presetTimezoneHelp { margin: -.35rem 0 .75rem; opacity: .7; }
.ec-presetSummary { display: flex; flex-wrap: wrap; gap: .4rem; }
.ec-presetSummary span { background: var(--ec-theme-action-hover); border-radius: 999px; padding: .35rem .65rem; }
.ec-presetSnapshotHelp { margin: .25rem 0 .75rem; opacity: .7; }
.ec-presetActions { display: flex; flex-wrap: wrap; gap: .65rem; }
.ec-presetRemove { color: var(--ec-theme-error-light); }
@media (max-width: 900px) { .ec-presetGrid, .ec-recurringSchedule { grid-template-columns: 1fr 1fr; } .ec-weekdayField { grid-column: span 2; } }
@media (max-width: 600px) {
  .ec-presetIntro { align-items: stretch; flex-direction: column; }
  .ec-presetGrid, .ec-presetScheduleGrid, .ec-recurringSchedule { grid-template-columns: 1fr; }
  .ec-weekdayField { grid-column: auto; }
}
</style>
