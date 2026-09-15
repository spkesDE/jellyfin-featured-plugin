<script setup lang="ts">
import type { FeaturedTrailerOverride } from '../../types/config';
import type { FeaturedSearchItem } from '../../types/featured';
import { t } from '../../i18n';
import ConfigCard from '../components/ConfigCard.vue';
import ConfigCheckbox from '../components/ConfigCheckbox.vue';
import ConfigNumber from '../components/ConfigNumber.vue';
import ConfigSelect, { type SelectOption } from '../components/ConfigSelect.vue';
import ConfigText from '../components/ConfigText.vue';
import ManualItemAutocomplete from '../components/ManualItemAutocomplete.vue';
import { useConfigStore } from '../libs/store';

const store = useConfigStore();
const sourceOptions: SelectOption[] = [
  { value: 'prefer_local', label: t('trailers.source.preferLocal') },
  { value: 'prefer_remote', label: t('trailers.source.preferRemote') },
  { value: 'local_only', label: t('trailers.source.localOnly') },
  { value: 'remote_only', label: t('trailers.source.remoteOnly') },
  { value: 'automatic', label: t('trailers.source.automatic') }
];
const multipleOptions: SelectOption[] = [
  { value: 'first', label: t('trailers.multiple.first') },
  { value: 'random', label: t('trailers.multiple.random') }
];

function addOverride(item: FeaturedSearchItem): void {
  const entry: FeaturedTrailerOverride = {
    ItemId: item.id,
    Name: item.name,
    Url: null,
    LocalTrailerItemId: null
  };
  store.config.TrailerOverrides.push(entry);
}
</script>

<template>
  <section id="featuredPanel-trailers" class="jmp-section jmp-section-plain" role="tabpanel"
    aria-labelledby="featuredTab-trailers">
    <div class="jmp-subgrid">
      <ConfigCard :title="t('trailers.backgroundTitle')" :help="t('trailers.backgroundHelp')">
        <ConfigCheckbox v-model="store.config.EnableBackgroundTrailers" :label="t('trailers.enabled')" />
        <template v-if="store.config.EnableBackgroundTrailers">
          <ConfigSelect v-model="store.config.TrailerSourcePriority" :label="t('trailers.sourceLabel')"
            :options="sourceOptions" />
          <ConfigCheckbox v-model="store.config.StartTrailersMuted" :label="t('trailers.startMuted')" />
          <ConfigCheckbox v-model="store.config.HideYouTubeTrailerUntilControlsFade"
            :label="t('trailers.hideYouTubeControls')" :help-text="t('trailers.hideYouTubeControlsHelp')" />
          <ConfigCheckbox v-model="store.config.WaitForTrailerToFinish" :label="t('trailers.waitForFinish')"
            :help-text="t('trailers.waitForFinishHelp')" />
          <ConfigCheckbox v-model="store.config.AllowTrailersOnMobile" :label="t('trailers.allowMobile')" />
        </template>
      </ConfigCard>

      <ConfigCard v-if="store.config.EnableBackgroundTrailers" :title="t('trailers.timingTitle')"
        :help="t('trailers.timingHelp')">
        <ConfigNumber v-model="store.config.TrailerDelayMilliseconds" :label="t('trailers.delay')" :min="0"
          :max="30000" :step="250" />
        <ConfigNumber v-model="store.config.TrailerStartOffsetSeconds" :label="t('trailers.startOffset')" :min="0"
          :max="3600" :step="1" />
        <ConfigNumber v-model="store.config.TrailerEndOffsetSeconds" :label="t('trailers.endOffset')" :min="0"
          :max="3600" :step="1" />
        <ConfigSelect v-model="store.config.MultipleTrailerMode" :label="t('trailers.multipleLabel')"
          :options="multipleOptions" />
      </ConfigCard>
    </div>

    <ConfigCard class="ec-trailerOverrides" :title="t('trailers.overridesTitle')" :help="t('trailers.overridesHelp')">
      <ManualItemAutocomplete input-id="trailer-override-search"
        :exclude-ids="store.config.TrailerOverrides.map((entry) => entry.ItemId)" @select="addOverride" />
      <div v-if="store.config.TrailerOverrides.length" class="ec-trailerOverrideList">
        <article v-for="(entry, index) in store.config.TrailerOverrides" :key="entry.ItemId"
          class="ec-trailerOverride">
          <div class="ec-trailerOverrideHeader">
            <strong>{{ entry.Name }}</strong>
            <button type="button" class="paper-icon-button-light ec-ruleIconButton ec-removeRule"
              :title="t('trailers.removeOverride')" @click="store.config.TrailerOverrides.splice(index, 1)">
              <span class="material-icons" aria-hidden="true">delete</span>
            </button>
          </div>
          <ConfigText v-model="entry.Url" :label="t('trailers.overrideUrl')"
            placeholder="https://www.youtube.com/watch?v=…" />
          <ConfigText v-model="entry.LocalTrailerItemId" :label="t('trailers.overrideLocalId')"
            :placeholder="t('common.optional')" />
          <p class="jmp-note">{{ t('trailers.overrideHint') }}</p>
        </article>
      </div>
      <p v-else class="jmp-note">{{ t('trailers.noOverrides') }}</p>
    </ConfigCard>
  </section>
</template>

<style scoped>
.ec-trailerOverrides { margin-top: 1rem; }
.ec-trailerOverrideList { display: grid; gap: .8rem; margin-top: 1rem; }
.ec-trailerOverride { background: rgba(255, 255, 255, .035); border: 1px solid rgba(255, 255, 255, .09); border-radius: .7rem; padding: .8rem; }
.ec-trailerOverrideHeader { align-items: center; display: flex; justify-content: space-between; }
.ec-trailerOverride :deep(.inputContainer) { margin-bottom: .7rem; }
.ec-trailerOverride .jmp-note { margin: 0; }
</style>
