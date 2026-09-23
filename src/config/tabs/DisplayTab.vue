<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import BannerPreview from '../components/BannerPreview.vue';
import ConfigCard from '../components/ConfigCard.vue';
import ConfigCheckbox from '../components/ConfigCheckbox.vue';
import ConfigNumber from '../components/ConfigNumber.vue';
import ConfigSelect, { type SelectOption } from '../components/ConfigSelect.vue';
import ConfigText from '../components/ConfigText.vue';
import { t } from '../../i18n';
import { useConfigStore } from '../libs/store';

const store = useConfigStore();
const displayEditor = ref<HTMLElement | null>(null);
const previewRail = ref<HTMLElement | null>(null);
const previewOffset = ref(0);
let previewFrame = 0;
let previewResizeObserver: ResizeObserver | null = null;

const previewPositionStyle = computed(() => ({
  transform: previewOffset.value ? `translateY(${previewOffset.value}px)` : undefined
}));

function updatePreviewPosition(): void {
  previewFrame = 0;
  const rail = previewRail.value;
  const editor = displayEditor.value;
  const preview = rail?.firstElementChild as HTMLElement | null;
  if (!rail || !editor || !preview || window.innerWidth <= 1050) {
    previewOffset.value = 0;
    return;
  }

  const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const appBarOffset = rootFontSize * 4;
  const toolbar = document.querySelector<HTMLElement>('#FeaturedConfigPage .jmp-toolbar');
  const toolbarRect = toolbar?.getBoundingClientRect();
  const visibleToolbarBottom = toolbarRect && toolbarRect.bottom > appBarOffset && toolbarRect.top <= appBarOffset + 1
    ? toolbarRect.bottom + rootFontSize
    : appBarOffset;
  const railRect = rail.getBoundingClientRect();
  const maximumOffset = Math.max(0, editor.offsetHeight - preview.offsetHeight);
  previewOffset.value = Math.min(maximumOffset, Math.max(0, visibleToolbarBottom - railRect.top));
}

function schedulePreviewPosition(): void {
  if (previewFrame) return;
  previewFrame = window.requestAnimationFrame(updatePreviewPosition);
}

onMounted(() => {
  document.addEventListener('scroll', schedulePreviewPosition, true);
  window.addEventListener('resize', schedulePreviewPosition);
  previewResizeObserver = new ResizeObserver(schedulePreviewPosition);
  if (displayEditor.value) previewResizeObserver.observe(displayEditor.value);
  if (previewRail.value?.firstElementChild) previewResizeObserver.observe(previewRail.value.firstElementChild);
  schedulePreviewPosition();
});

onBeforeUnmount(() => {
  document.removeEventListener('scroll', schedulePreviewPosition, true);
  window.removeEventListener('resize', schedulePreviewPosition);
  previewResizeObserver?.disconnect();
  if (previewFrame) window.cancelAnimationFrame(previewFrame);
});
function focusSection(event: Event): void {
  const current = event.currentTarget as HTMLDetailsElement;
  if (!current.open) return;
  displayEditor.value?.querySelectorAll<HTMLDetailsElement>('details.ec-displayGroup').forEach((entry) => {
    if (entry !== current) entry.open = false;
  });
}
function openPreviewSection(section: string): void {
  void nextTick(() => {
    const target = displayEditor.value?.querySelector<HTMLDetailsElement>(`[data-display-section="${section}"]`);
    if (!target) return;
    displayEditor.value?.querySelectorAll<HTMLDetailsElement>('details.ec-displayGroup').forEach((entry) => {
      entry.open = entry === target;
    });
  });
}
const transitionOptions: SelectOption[] = [
  { value: 'slide', label: t('option.slide') },
  { value: 'fade', label: t('option.fade') }
];
const positionOptions: SelectOption[] = [
  { value: 'top', label: t('option.top') }, { value: 'center', label: t('option.center') }, { value: 'bottom', label: t('option.bottom') }
];
const heightModeOptions: SelectOption[] = [
  { value: 'auto', label: t('option.heightAuto') },
  { value: 'compact', label: t('option.heightCompact') },
  { value: 'standard', label: t('option.heightStandard') },
  { value: 'cinematic', label: t('option.heightCinematic') },
  { value: 'fullscreen', label: t('option.heightFullscreen') },
  { value: 'custom', label: t('option.heightCustom') }
];
const fadeCurveOptions: SelectOption[] = [
  { value: 'soft', label: t('option.fadeSoft') },
  { value: 'balanced', label: t('option.fadeBalanced') },
  { value: 'strong', label: t('option.fadeStrong') }
];
const textPositionOptions: SelectOption[] = [
  { value: 'left', label: t('option.left') },
  { value: 'center', label: t('option.center') },
  { value: 'right', label: t('option.right') }
];
const titleOptions: SelectOption[] = [
  { value: 'logo', label: t('option.preferLogo') },
  { value: 'title', label: t('option.alwaysTitle') }
];
const placementOptions: SelectOption[] = [
  { value: 'metadata', label: t('display.placementMetadata') },
  { value: 'actions', label: t('display.placementActions') }
];
</script>

<template>
  <section id="featuredPanel-display" class="jmp-section jmp-section-plain" role="tabpanel" aria-labelledby="featuredTab-display">
    <div class="ec-displayWorkspace">
      <div ref="displayEditor" class="ec-displayEditor">
      <details class="ec-displayGroup" data-display-section="layout" open @toggle="focusSection($event)">
        <summary><span class="material-icons" aria-hidden="true">aspect_ratio</span><span><strong>{{ t('display.layout') }}</strong><small>{{ t('display.layoutHelp') }}</small></span><span class="material-icons ec-displayGroupChevron" aria-hidden="true">expand_more</span></summary>
        <div class="ec-displayGroupBody">
          <ConfigCheckbox v-model="store.config.UseHeroLayout" :label="t('display.heroLayout')" />
          <ConfigSelect v-model="store.config.HeroHeightMode" :label="t('display.heightMode')" :options="heightModeOptions" />
          <ConfigNumber v-if="store.config.HeroHeightMode === 'custom'" v-model="store.config.BannerHeight" :label="t('display.desktopHeight')" :min="240" :max="900" :step="10" />
          <div class="jmp-compactGrid">
            <ConfigNumber v-model="store.config.TabletBannerHeight" :label="t('display.tabletHeight')" :min="240" :max="700" :step="10" />
            <ConfigNumber v-model="store.config.MobileBannerHeight" :label="t('display.mobileHeight')" :min="220" :max="600" :step="10" />
          </div>
          <ConfigNumber v-if="!store.config.UseHeroLayout" v-model="store.config.HeroBorderRadius" :label="t('display.borderRadius')" :min="0" :max="48" :step="1" />
          <template v-if="store.config.UseHeroLayout">
            <ConfigNumber v-model="store.config.HeroGradientStrength" :label="t('display.gradientStrength')" :min="0" :max="100" :step="5" />
            <div class="jmp-compactGrid">
              <ConfigNumber v-model="store.config.HeroFadeStart" :label="t('display.fadeStart')" :min="0" :max="Math.max(0, store.config.HeroFadeEnd - 1)" :step="1" />
              <ConfigNumber v-model="store.config.HeroFadeEnd" :label="t('display.fadeEnd')" :min="Math.min(100, store.config.HeroFadeStart + 1)" :max="100" :step="1" />
            </div>
            <ConfigSelect v-model="store.config.HeroFadeCurve" :label="t('display.fadeCurve')" :options="fadeCurveOptions" />
          </template>
          <div class="jmp-compactGrid">
            <ConfigSelect v-model="store.config.HeroTextPosition" :label="t('display.textPosition')" :options="textPositionOptions" />
            <ConfigSelect v-model="store.config.HeroBackdropPosition" :label="t('display.backdropPosition')" :options="positionOptions" />
          </div>
          <ConfigSelect v-model="store.config.TransitionEffect" :label="t('display.transitionEffect')" :options="transitionOptions" />
          <ConfigNumber v-model="store.config.MediaPadding" :label="t('display.spaceBelow')" :help-text="store.config.UseHeroLayout ? t('display.heroMinimumGap') : undefined" :min="-240" :max="240" :step="4" />
        </div>
      </details>

      <details class="ec-displayGroup" data-display-section="metadata" @toggle="focusSection($event)">
        <summary><span class="material-icons" aria-hidden="true">subtitles</span><span><strong>{{ t('display.metadata') }}</strong><small>{{ t('display.metadataHelp') }}</small></span><span class="material-icons ec-displayGroupChevron" aria-hidden="true">expand_more</span></summary>
        <div class="ec-displayGroupBody">
          <ConfigSelect v-model="store.config.TitleDisplayMode" :label="t('display.titleDisplay')" :options="titleOptions" />
          <ConfigText v-if="!store.config.UseHeroLayout" v-model="store.config.Heading" :label="t('display.bannerHeading')" :placeholder="t('common.optional')" />
          <ConfigCheckbox v-model="store.config.ShowDescription" :label="t('display.showDescription')" />
          <ConfigCheckbox v-model="store.config.ShowRating" :label="t('display.showRatings')" />
          <ConfigCheckbox v-model="store.config.ShowYear" :label="t('display.showYear')" />
          <ConfigCheckbox v-model="store.config.ShowRuntime" :label="t('display.showRuntime')" />
        </div>
      </details>

      <details class="ec-displayGroup" data-display-section="actions" @toggle="focusSection($event)">
        <summary><span class="material-icons" aria-hidden="true">smart_button</span><span><strong>{{ t('display.actions') }}</strong><small>{{ t('display.actionsHelp') }}</small></span><span class="material-icons ec-displayGroupChevron" aria-hidden="true">expand_more</span></summary>
        <div class="ec-displayGroupBody">
          <ConfigCheckbox v-model="store.config.ShowPlayButton" :label="t('display.showPlayButton')" />
          <ConfigText v-if="store.config.ShowPlayButton" v-model="store.config.PlayButtonText" :label="t('display.customPlayText')" :placeholder="t('common.play')" />
          <ConfigCheckbox v-model="store.config.ShowSecondaryButton" :label="t('display.showSecondaryButton')" />
          <ConfigText v-if="store.config.ShowSecondaryButton" v-model="store.config.SecondaryButtonText" :label="t('display.secondaryButtonText')" :placeholder="t('display.moreInfo')" />
          <div class="ec-dependentSetting">
            <ConfigCheckbox v-model="store.config.ShowFavoriteButton" :label="t('display.showFavoriteButton')" />
            <ConfigSelect v-if="store.config.ShowFavoriteButton" v-model="store.config.FavoriteButtonPlacement" :label="t('display.controlPlacement')" :options="placementOptions" />
          </div>
          <div class="ec-dependentSetting">
            <ConfigCheckbox v-model="store.config.ShowPlaystateButton" :label="t('display.showPlaystateButton')" />
            <ConfigSelect v-if="store.config.ShowPlaystateButton" v-model="store.config.PlaystateButtonPlacement" :label="t('display.controlPlacement')" :options="placementOptions" />
          </div>
          <div class="ec-dependentSetting">
            <ConfigCheckbox v-model="store.config.ShowDismissalButton" :label="t('display.showDismissalButton')" :disabled="!store.config.DismissalPolicy.Enabled" />
            <ConfigSelect v-if="store.config.ShowDismissalButton && store.config.DismissalPolicy.Enabled" v-model="store.config.DismissalButtonPlacement" :label="t('display.controlPlacement')" :options="placementOptions" />
          </div>
        </div>
      </details>

      <details class="ec-displayGroup" data-display-section="navigation" @toggle="focusSection($event)">
        <summary><span class="material-icons" aria-hidden="true">tune</span><span><strong>{{ t('display.navigationAndAutoplay') }}</strong><small>{{ t('display.navigationAndAutoplayHelp') }}</small></span><span class="material-icons ec-displayGroupChevron" aria-hidden="true">expand_more</span></summary>
        <div class="ec-displayGroupBody">
          <ConfigCheckbox v-model="store.config.ShowNavigationArrows" :label="t('display.showNavigation')" />
          <ConfigCheckbox v-if="!store.config.EnableInfiniteLoading" v-model="store.config.ShowPaginationDots" :label="t('display.showPaginationDots')" />
          <ConfigCheckbox v-if="!store.config.EnableInfiniteLoading && !store.config.ShowPaginationDots" v-model="store.config.ShowSlidePosition" :label="t('display.showPosition')" />
          <ConfigCheckbox v-model="store.config.EnableAutoplay" :label="t('display.enableAutoplay')" :help-text="t('display.autoplayHelp')" />
          <ConfigNumber v-if="store.config.EnableAutoplay" v-model="store.config.AutoplayInterval" :label="t('display.intervalSeconds')" :min="1" :max="3600" :step="1" />
          <ConfigCheckbox v-if="store.config.EnableAutoplay" v-model="store.config.ShowAutoplayButton" :label="t('display.showAutoplayControl')" />
          <ConfigCheckbox v-model="store.config.ShowControlsOnHoverOnly" :label="t('display.showControlsOnHoverOnly')" :help-text="t('display.showControlsOnHoverOnlyHelp')" />
          <ConfigCheckbox v-model="store.config.ShowTrailerControls" :label="t('trailers.showControls')" :help-text="t('trailers.showControlsHelp')" />
        </div>
      </details>

      <details class="ec-displayGroup" data-display-section="behavior" @toggle="focusSection($event)">
        <summary><span class="material-icons" aria-hidden="true">devices</span><span><strong>{{ t('display.behavior') }}</strong><small>{{ t('display.behaviorHelp') }}</small></span><span class="material-icons ec-displayGroupChevron" aria-hidden="true">expand_more</span></summary>
        <div class="ec-displayGroupBody">
          <ConfigCheckbox v-model="store.config.InteractOnWholeBanner" :label="t('display.interactOnWholeBanner')" :help-text="t('display.interactOnWholeBannerHelp')" />
          <ConfigNumber v-if="!store.config.EnableInfiniteLoading" v-model="store.config.RandomMediaCount" :label="t('display.maximumSlides')" :min="1" :max="100" :step="1" />
          <ConfigCheckbox v-model="store.config.HideOnTvLayout" :label="t('display.hideTv')" />
        </div>
      </details>
      </div>

      <div ref="previewRail" class="ec-previewRail">
        <ConfigCard class="ec-preview-section" :style="previewPositionStyle" :title="t('display.livePreview')" :help="t('display.livePreviewHelp')">
          <BannerPreview @focus-section="openPreviewSection" />
        </ConfigCard>
      </div>
    </div>
  </section>
</template>

<style scoped>
.ec-displayWorkspace { align-items: start; display: grid; gap: 1.25rem; grid-template-columns: minmax(25rem, 1.25fr) minmax(28rem, .9fr); }
.ec-displayEditor { display: grid; gap: .75rem; }
.ec-displayGroup { background: var(--ec-config-card-background); border: 1px solid var(--ec-theme-divider); border-radius: .9rem; overflow: hidden; }
.ec-displayGroup > summary { align-items: center; cursor: pointer; display: grid; gap: .75rem; grid-template-columns: auto minmax(0, 1fr) auto; list-style: none; padding: .85rem 1rem; }
.ec-displayGroup > summary::-webkit-details-marker { display: none; }
.ec-displayGroup > summary > span:nth-child(2) { display: grid; gap: .1rem; }
.ec-displayGroup > summary small { font-size: .78rem; font-weight: 400; opacity: .65; }
.ec-displayGroupChevron { transition: transform .16s ease; }
.ec-displayGroup[open] .ec-displayGroupChevron { transform: rotate(180deg); }
.ec-displayGroupBody { border-top: 1px solid rgba(255, 255, 255, .07); padding: 1rem; }
.ec-displayGroupBody > :deep(.checkboxContainer:last-child), .ec-displayGroupBody > :deep(.inputContainer:last-child), .ec-displayGroupBody > :deep(.selectContainer:last-child) { margin-bottom: 0; }
.ec-dependentSetting { border-top: 1px solid rgba(255, 255, 255, .07); margin-top: .7rem; padding-top: .7rem; }
.ec-previewRail { align-self: stretch; min-width: 0; }
.ec-preview-section {
  box-sizing: border-box;
  max-height: calc(100vh - var(--ec-config-appbar-offset) - 1rem);
  overflow-y: auto;
  overscroll-behavior: contain;
  position: relative;
  scrollbar-width: thin;
  will-change: transform;
}
@media (max-width: 1050px) {
  .ec-displayWorkspace { grid-template-columns: 1fr; }
  .ec-previewRail { grid-row: 1; }
  .ec-preview-section { max-height: none; overflow: visible; transform: none !important; }
}
@media (max-width: 600px) { .ec-displayWorkspace { grid-template-columns: minmax(0, 1fr); } }
</style>
