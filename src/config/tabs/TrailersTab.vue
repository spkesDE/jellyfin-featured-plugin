<script setup lang="ts">
import { computed } from 'vue';
import type { FeaturedTrailerOverride } from '../../types/config';
import type { FeaturedSearchItem } from '../../types/featured';
import { t } from '../../i18n';
import { posterUrl } from '../../slider/images';
import ConfigCard from '../components/ConfigCard.vue';
import ConfigGrid from '../components/ConfigGrid.vue';
import ConfigListHeader from '../components/ConfigListHeader.vue';
import ConfigSection from '../components/ConfigSection.vue';
import ConfigSwitch from '../components/ConfigSwitch.vue';
import ConfigNumber from '../components/ConfigNumber.vue';
import ConfigPriorityList from '../components/ConfigPriorityList.vue';
import ConfigSelect, { type SelectOption } from '../components/ConfigSelect.vue';
import ConfigText from '../components/ConfigText.vue';
import ManualItemAutocomplete from '../components/ManualItemAutocomplete.vue';
import { useConfigStore } from '../libs/store';
import { mediaPriorityLabel } from '../libs/sourceTypes';

const store = useConfigStore();
const trailerUrlPlaceholder = 'https://www.youtube.com/watch?v=…';
const apiKeyVariable = 'JELLYFIN_FEATURED_YOUTUBE_API_KEY';
const multipleOptions: SelectOption[] = [
  { value: 'first', label: t('trailers.multiple.first') },
  { value: 'random', label: t('trailers.multiple.random') }
];

/** The HD filter needs a server-side API key; an unknown key state (status not loaded yet) keeps it selectable. */
const apiKeyMissing = computed(() => store.youTubeApiKeyConfigured.value === false);
const qualityOptions = computed((): SelectOption[] => [
  { value: 'disabled', label: t('trailers.quality.disabled') },
  { value: 'hd_only', label: t('trailers.quality.hdOnly'), disabled: apiKeyMissing.value }
]);

const excerptSourceCount = computed(
  () =>
    store.config.SourceRules.filter((rule) =>
      rule.MediaPriority.some((entry) => entry.Type === 'media_excerpt' && entry.Enabled)
    ).length
);

const summary = computed(() => {
  if (!store.config.EnableBackgroundTrailers) return t('preset.state.disabled');
  return [
    t('common.enabled'),
    store.config.DefaultMediaPriority.filter((entry) => entry.Enabled)
      .map(mediaPriorityLabel)
      .join(' → '),
    store.config.YouTubeQualityFilter === 'hd_only' ? t('trailers.quality.hdOnly') : null,
    store.config.TrailerOverrides.length
      ? t('trailers.overridesCount', { count: store.config.TrailerOverrides.length })
      : null
  ]
    .filter(Boolean)
    .join(' · ');
});

function addOverride(item: FeaturedSearchItem): void {
  const entry: FeaturedTrailerOverride = {
    ItemId: item.id,
    Name: item.name,
    Url: null,
    LocalTrailerItemId: null
  };
  store.config.TrailerOverrides.push(entry);
}

function hidePoster(event: Event): void {
  (event.target as HTMLImageElement).style.visibility = 'hidden';
}
</script>

<template>
  <section
    id="featuredPanel-trailers"
    class="jmp-section jmp-section-plain"
    role="tabpanel"
    aria-labelledby="featuredTab-trailers"
  >
    <ConfigListHeader
      :title="t('trailers.backgroundTitle')"
      :help-text="t('trailers.backgroundHelp')"
      :summary="summary"
    >
      <template #actions>
        <label class="featured-trailerMaster">
          <span>{{ t('common.enabled') }}</span>
          <ConfigSwitch v-model="store.config.EnableBackgroundTrailers" :label="t('trailers.enabled')" hide-label />
        </label>
      </template>
    </ConfigListHeader>

    <div class="featured-trailerLayout">
      <ConfigCard v-if="store.config.EnableBackgroundTrailers" :title="t('trailers.playbackTitle')">
        <ConfigSection :title="t('trailers.selectionTitle')">
          <ConfigPriorityList
            v-model="store.config.DefaultMediaPriority"
            item-key="Type"
            :label="t('trailers.sourceLabel')"
            :help-text="t('trailers.sourceHelp')"
            :item-label="mediaPriorityLabel"
            :fixed-label="t('source.mediaPriority.stillImage')"
            :fixed-hint="t('source.mediaPriority.stillImageHint')"
          />
          <ConfigGrid>
            <ConfigSelect
              v-model="store.config.MultipleTrailerMode"
              :label="t('trailers.multipleLabel')"
              :options="multipleOptions"
            />
          </ConfigGrid>
        </ConfigSection>

        <ConfigSection :title="t('trailers.quality.section')" :help-text="t('trailers.quality.help')">
          <ConfigGrid>
            <ConfigSelect
              v-model="store.config.YouTubeQualityFilter"
              :label="t('trailers.quality.label')"
              :options="qualityOptions"
            />
          </ConfigGrid>
          <div v-if="apiKeyMissing" class="featured-warningNotice featured-youtubeKeyNotice" role="status">
            <span class="material-icons" aria-hidden="true">vpn_key</span>
            <div class="featured-youtubeKeyCopy">
              <strong>{{ t('trailers.quality.apiKeyMissing') }}</strong>
              <span>
                {{ t('trailers.quality.apiKeyHowTo') }} <code>{{ apiKeyVariable }}</code>
                {{ t('trailers.quality.apiKeyHowToSuffix') }}
              </span>
            </div>
            <a
              class="featured-textButton featured-youtubeKeyLink"
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ t('trailers.quality.apiKeyLink') }}
              <span class="material-icons" aria-hidden="true">open_in_new</span>
            </a>
          </div>
        </ConfigSection>

        <ConfigSection :title="t('trailers.timingTitle')" :help-text="t('trailers.timingHelp')">
          <ConfigGrid :columns="3">
            <ConfigNumber
              v-model="store.config.TrailerDelayMilliseconds"
              :label="t('trailers.delay')"
              :min="0"
              :max="30000"
              :step="250"
            />
            <ConfigNumber
              v-model="store.config.TrailerStartOffsetSeconds"
              :label="t('trailers.startOffset')"
              :min="0"
              :max="3600"
              :step="1"
            />
            <ConfigNumber
              v-model="store.config.TrailerEndOffsetSeconds"
              :label="t('trailers.endOffset')"
              :min="0"
              :max="3600"
              :step="1"
            />
          </ConfigGrid>
        </ConfigSection>
      </ConfigCard>
      <ConfigCard v-else>
        <p class="jmp-note featured-trailerOff">{{ t('trailers.playbackDisabledHelp') }}</p>
      </ConfigCard>

      <div class="featured-trailerAside">
        <ConfigCard v-if="store.config.EnableBackgroundTrailers" :title="t('trailers.behaviorTitle')">
          <ConfigSwitch v-model="store.config.StartTrailersMuted" :label="t('trailers.startMuted')" />
          <ConfigSwitch v-model="store.config.AllowTrailersOnMobile" :label="t('trailers.allowMobile')" />
          <ConfigSwitch
            v-model="store.config.WaitForTrailerToFinish"
            :label="t('trailers.waitForFinish')"
            :help-text="t('trailers.waitForFinishHelp')"
          />
          <ConfigSwitch
            v-model="store.config.HideYouTubeTrailerUntilControlsFade"
            :label="t('trailers.hideYouTubeControls')"
            :help-text="t('trailers.hideYouTubeControlsHelp')"
          />
        </ConfigCard>

        <ConfigCard
          v-if="excerptSourceCount"
          :title="t('trailers.excerptTitle')"
          :help="t('trailers.excerptWindowHint')"
        >
          <p class="featured-trailerUsage">
            {{
              excerptSourceCount === 1
                ? t('trailers.excerptUsageOne')
                : t('trailers.excerptUsage', { count: excerptSourceCount })
            }}
          </p>
          <ConfigGrid>
            <ConfigNumber
              v-model="store.config.MediaExcerptWindowStartMinutes"
              :label="t('trailers.excerptWindowStart')"
              :min="0"
              :max="600"
              :step="1"
            />
            <ConfigNumber
              v-model="store.config.MediaExcerptWindowEndMinutes"
              :label="t('trailers.excerptWindowEnd')"
              :min="store.config.MediaExcerptWindowStartMinutes"
              :max="600"
              :step="1"
            />
          </ConfigGrid>
          <ConfigNumber
            v-model="store.config.MediaExcerptDurationSeconds"
            :label="t('trailers.excerptDuration')"
            :min="10"
            :max="120"
            :step="5"
          />
          <p class="jmp-note">{{ t('trailers.excerptTranscodeHint') }}</p>
        </ConfigCard>
      </div>
    </div>

    <ConfigListHeader
      class="featured-trailerOverridesHeader"
      :title="t('trailers.overridesTitle')"
      :help-text="`${t('trailers.overridesHelp')} ${t('trailers.overrideHint')}`"
      :summary="t('trailers.overridesCount', { count: store.config.TrailerOverrides.length })"
    />
    <ConfigCard>
      <ManualItemAutocomplete
        input-id="trailer-override-search"
        :exclude-ids="store.config.TrailerOverrides.map((entry) => entry.ItemId)"
        @select="addOverride"
      />
      <div v-if="store.config.TrailerOverrides.length" class="featured-overrideTable">
        <div class="featured-overrideRow featured-overrideHead" aria-hidden="true">
          <span></span>
          <span>{{ t('trailers.overrideItem') }}</span>
          <span>{{ t('trailers.overrideUrl') }}</span>
          <span>{{ t('trailers.overrideLocalId') }}</span>
          <span></span>
        </div>
        <div v-for="(entry, index) in store.config.TrailerOverrides" :key="entry.ItemId" class="featured-overrideRow">
          <img class="featured-overridePoster" :src="posterUrl(entry.ItemId)" alt="" @error="hidePoster" />
          <span class="featured-overrideName">{{ entry.Name }}</span>
          <ConfigText v-model="entry.Url" :placeholder="trailerUrlPlaceholder" />
          <ConfigText v-model="entry.LocalTrailerItemId" :placeholder="t('common.optional')" />
          <button
            type="button"
            class="paper-icon-button-light featured-ruleIconButton featured-removeRule"
            :title="t('trailers.removeOverride')"
            :aria-label="`${entry.Name}: ${t('trailers.removeOverride')}`"
            @click="store.config.TrailerOverrides.splice(index, 1)"
          >
            <span class="material-icons" aria-hidden="true">close</span>
          </button>
        </div>
      </div>
      <p v-else class="jmp-note">{{ t('trailers.noOverrides') }}</p>
    </ConfigCard>
  </section>
</template>

<style scoped>
.featured-trailerMaster {
  align-items: center;
  cursor: pointer;
  display: flex;
  gap: 0.6rem;
}
.featured-trailerMaster > span {
  font-size: 0.9rem;
  opacity: 0.75;
}
.featured-trailerOverridesHeader {
  margin-top: 1.25rem;
}
.featured-trailerLayout {
  align-items: start;
  display: grid;
  gap: 1rem;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
}
.featured-trailerLayout :deep(.jmp-subsection),
.featured-trailerAside :deep(.jmp-subsection) {
  margin-bottom: 0;
}
.featured-trailerAside {
  display: grid;
  gap: 1rem;
}
.featured-trailerAside :deep(.inputContainer) {
  margin-bottom: 0.5rem;
}
.featured-trailerOff {
  margin: 0;
}
.featured-trailerUsage {
  font-size: 0.85rem;
  margin: -0.4rem 0 0.75rem;
  opacity: 0.65;
}
.featured-youtubeKeyNotice {
  align-items: flex-start;
  flex-wrap: wrap;
}
.featured-youtubeKeyCopy {
  display: grid;
  flex: 1 1 14rem;
  gap: 0.2rem;
  line-height: 1.4;
  min-width: 0;
}
.featured-youtubeKeyCopy > span {
  color: var(--featured-theme-text-secondary);
  font-size: 0.82rem;
}
.featured-youtubeKeyCopy code {
  background: var(--featured-theme-action-focus);
  border-radius: 0.2rem;
  color: var(--featured-theme-text-primary);
  overflow-wrap: anywhere;
  padding: 0.05rem 0.3rem;
}
.featured-youtubeKeyLink {
  color: inherit;
  text-decoration: none;
  white-space: nowrap;
}
.featured-youtubeKeyLink .material-icons {
  font-size: 1rem;
}
.featured-overrideTable {
  margin-top: 0.75rem;
}
.featured-overrideRow {
  align-items: center;
  border-top: 1px solid var(--featured-theme-divider);
  display: grid;
  gap: 0.6rem;
  grid-template-columns: 1.8rem minmax(0, 1.1fr) minmax(0, 1.6fr) minmax(0, 1fr) 2.35rem;
  padding: 0.4rem 0;
}
.featured-overrideHead {
  border-top: 0;
  font-size: 0.8rem;
  opacity: 0.6;
  padding-bottom: 0;
}
.featured-overrideRow :deep(.inputContainer) {
  margin-bottom: 0;
}
.featured-overridePoster {
  aspect-ratio: 2 / 3;
  background: var(--featured-theme-action-hover);
  border-radius: 0.2rem;
  object-fit: cover;
  width: 1.8rem;
}
.featured-overrideName {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 1000px) {
  .featured-trailerLayout {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 700px) {
  .featured-overrideHead {
    display: none;
  }
  .featured-overrideRow {
    grid-template-columns: 1.8rem minmax(0, 1fr) 2.35rem;
  }
  .featured-overrideRow > :deep(.inputContainer) {
    grid-column: 1 / -1;
  }
}
</style>
