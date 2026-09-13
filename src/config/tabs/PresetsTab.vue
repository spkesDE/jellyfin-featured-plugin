<script setup lang="ts">
import { t } from '../../i18n';
import type { FeaturedPreset } from '../../types/config';
import ConfigCard from '../components/ConfigCard.vue';
import ConfigCheckbox from '../components/ConfigCheckbox.vue';
import ConfigDateTime from '../components/ConfigDateTime.vue';
import ConfigNumber from '../components/ConfigNumber.vue';
import ConfigText from '../components/ConfigText.vue';
import { useConfigStore } from '../libs/store';

const store = useConfigStore();

function scheduleState(preset: FeaturedPreset): 'disabled' | 'active' | 'scheduled' | 'expired' {
  if (!preset.Enabled) return 'disabled';
  const now = Date.now();
  const starts = preset.StartsAt ? new Date(preset.StartsAt).getTime() : Number.NEGATIVE_INFINITY;
  const ends = preset.EndsAt ? new Date(preset.EndsAt).getTime() : Number.POSITIVE_INFINITY;
  if (now < starts) return 'scheduled';
  if (now >= ends) return 'expired';
  return 'active';
}

function stateLabel(preset: FeaturedPreset): string {
  return t(`preset.state.${scheduleState(preset)}` as Parameters<typeof t>[0]);
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
        <button type="button" class="raised button-submit emby-button ec-primaryAction" @click="store.addPreset()">
          <span class="material-icons" aria-hidden="true">add</span>
          {{ t('preset.add') }}
        </button>
      </div>
    </ConfigCard>

    <div v-if="store.config.Presets.length" class="ec-presetList">
      <ConfigCard
        v-for="(preset, index) in store.config.Presets"
        :key="preset.Id"
        :title="preset.Name || t('preset.defaultName')"
        :badge="stateLabel(preset)"
        :badge-tone="scheduleState(preset) === 'active' ? 'default' : 'muted'"
      >
        <div class="ec-presetGrid">
          <ConfigText v-model="preset.Name" :label="t('preset.name')" />
          <ConfigNumber v-model="preset.Priority" :label="t('preset.priority')" :help-text="t('preset.priorityHelp')" :min="-1000" :max="1000" :step="1" />
          <ConfigDateTime v-model="preset.StartsAt" :label="t('preset.startsAt')" />
          <ConfigDateTime v-model="preset.EndsAt" :label="t('preset.endsAt')" />
        </div>
        <ConfigCheckbox v-model="preset.Enabled" :label="t('preset.enabled')" :help-text="t('preset.enabledHelp')" />

        <div class="ec-presetSummary" :aria-label="t('preset.snapshotSummary')">
          <span>{{ t('preset.sourcesSummary', { count: preset.SourceRules.length }) }}</span>
          <span>{{ t('preset.filtersSummary', { count: preset.GlobalFilters.length }) }}</span>
          <span>{{ preset.PersonalizationPolicy.Enabled ? t('preset.personalizationOn') : t('preset.personalizationOff') }}</span>
          <span>{{ preset.Layout.UseHeroLayout ? t('preset.heroLayout') : t('preset.standardLayout') }}</span>
          <span>{{ preset.Trailers.EnableBackgroundTrailers ? t('preset.trailersOn') : t('preset.trailersOff') }}</span>
        </div>

        <p class="ec-presetSnapshotHelp">{{ t('preset.snapshotHelp') }}</p>
        <div class="ec-presetActions">
          <button type="button" class="raised emby-button ec-secondaryAction" @click="store.updatePresetSnapshot(index)">
            <span class="material-icons" aria-hidden="true">sync</span>
            {{ t('preset.updateSnapshot') }}
          </button>
          <button type="button" class="raised emby-button ec-secondaryAction" @click="store.duplicatePreset(index)">
            <span class="material-icons" aria-hidden="true">content_copy</span>
            {{ t('preset.duplicate') }}
          </button>
          <button type="button" class="raised emby-button ec-secondaryAction ec-presetRemove" @click="store.removePreset(index)">
            <span class="material-icons" aria-hidden="true">delete</span>
            {{ t('preset.remove') }}
          </button>
        </div>
      </ConfigCard>
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
.ec-presetGrid { display: grid; gap: 1rem; grid-template-columns: 2fr 1fr 1.5fr 1.5fr; }
.ec-presetSummary { display: flex; flex-wrap: wrap; gap: .5rem; margin: .75rem 0; }
.ec-presetSummary span { background: rgba(255, 255, 255, .07); border-radius: 999px; padding: .35rem .65rem; }
.ec-presetSnapshotHelp { margin: .25rem 0 .75rem; opacity: .7; }
.ec-presetActions { display: flex; flex-wrap: wrap; gap: .65rem; }
.ec-presetRemove { color: #ffb4ab; }
@media (max-width: 900px) { .ec-presetGrid { grid-template-columns: 1fr 1fr; } }
@media (max-width: 600px) {
  .ec-presetIntro { align-items: stretch; flex-direction: column; }
  .ec-presetGrid { grid-template-columns: 1fr; }
}
</style>
