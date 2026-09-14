<script setup lang="ts">
import BannerPreview from '../components/BannerPreview.vue';
import ConfigCard from '../components/ConfigCard.vue';
import ConfigCheckbox from '../components/ConfigCheckbox.vue';
import ConfigNumber from '../components/ConfigNumber.vue';
import ConfigSelect, { type SelectOption } from '../components/ConfigSelect.vue';
import ConfigText from '../components/ConfigText.vue';
import { t } from '../../i18n';
import { useConfigStore } from '../libs/store';

const store = useConfigStore();
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
  { value: 'custom', label: t('option.heightCustom') }
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
</script>

<template>
  <section id="featuredPanel-display" class="jmp-section jmp-section-plain" role="tabpanel" aria-labelledby="featuredTab-display">
    <div class="ec-displayGrid">
      <ConfigCard class="ec-preview-section" :title="t('display.livePreview')" :help="t('display.livePreviewHelp')">
        <BannerPreview />
      </ConfigCard>

      <ConfigCard class="ec-displayLayoutCard" :title="t('display.layout')" :help="t('display.layoutHelp')">
        <ConfigCheckbox v-model="store.config.UseHeroLayout" :label="t('display.heroLayout')" />
        <ConfigSelect v-model="store.config.HeroHeightMode" :label="t('display.heightMode')" :options="heightModeOptions" />
        <ConfigNumber v-if="store.config.HeroHeightMode === 'custom'" v-model="store.config.BannerHeight" :label="t('display.desktopHeight')" :min="240" :max="900" :step="10" />
        <ConfigNumber v-model="store.config.TabletBannerHeight" :label="t('display.tabletHeight')" :min="240" :max="700" :step="10" />
        <ConfigNumber v-model="store.config.MobileBannerHeight" :label="t('display.mobileHeight')" :min="220" :max="600" :step="10" />
        <ConfigNumber v-if="!store.config.UseHeroLayout" v-model="store.config.HeroBorderRadius" :label="t('display.borderRadius')" :min="0" :max="48" :step="1" />
        <ConfigNumber v-if="store.config.UseHeroLayout" v-model="store.config.HeroGradientStrength" :label="t('display.gradientStrength')" :min="0" :max="100" :step="5" />
        <ConfigSelect v-model="store.config.HeroTextPosition" :label="t('display.textPosition')" :options="textPositionOptions" />
        <ConfigSelect v-model="store.config.HeroBackdropPosition" :label="t('display.backdropPosition')" :options="positionOptions" />
        <ConfigSelect v-model="store.config.TransitionEffect" :label="t('display.transitionEffect')" :options="transitionOptions" />
        <ConfigSelect v-model="store.config.TitleDisplayMode" :label="t('display.titleDisplay')" :options="titleOptions" />
        <ConfigText v-model="store.config.Heading" :label="t('display.bannerHeading')" :placeholder="t('common.optional')" />
        <ConfigNumber v-model="store.config.MediaPadding" :label="t('display.spaceBelow')" :help-text="store.config.UseHeroLayout ? t('display.heroMinimumGap') : undefined" :min="-240" :max="240" :step="4" />
      </ConfigCard>

      <ConfigCard class="ec-displayContentCard" :title="t('display.content')" :help="t('display.contentHelp')">
        <ConfigCheckbox v-model="store.config.ShowRating" :label="t('display.showRatings')" />
        <ConfigCheckbox v-model="store.config.ShowDescription" :label="t('display.showDescription')" />
        <ConfigCheckbox v-model="store.config.ShowYear" :label="t('display.showYear')" />
        <ConfigCheckbox v-model="store.config.ShowRuntime" :label="t('display.showRuntime')" />
        <ConfigCheckbox v-model="store.config.ShowPlayButton" :label="t('display.showPlayButton')" />
        <ConfigText v-if="store.config.ShowPlayButton" v-model="store.config.PlayButtonText" :label="t('display.customPlayText')" :placeholder="t('common.play')" />
        <ConfigCheckbox v-model="store.config.ShowSecondaryButton" :label="t('display.showSecondaryButton')" />
        <ConfigText v-if="store.config.ShowSecondaryButton" v-model="store.config.SecondaryButtonText" :label="t('display.secondaryButtonText')" :placeholder="t('display.moreInfo')" />
        <ConfigCheckbox v-model="store.config.ShowNavigationArrows" :label="t('display.showNavigation')" />
        <ConfigCheckbox v-model="store.config.ShowControlsOnHoverOnly" :label="t('display.showControlsOnHoverOnly')" :help-text="t('display.showControlsOnHoverOnlyHelp')" />
        <ConfigCheckbox v-model="store.config.InteractOnWholeBanner" :label="t('display.interactOnWholeBanner')" :help-text="t('display.interactOnWholeBannerHelp')" />
        <ConfigCheckbox v-if="!store.config.EnableInfiniteLoading && !store.config.ShowPaginationDots" v-model="store.config.ShowSlidePosition" :label="t('display.showPosition')" />
        <ConfigCheckbox v-if="!store.config.EnableInfiniteLoading" v-model="store.config.ShowPaginationDots" :label="t('display.showPaginationDots')" />
        <ConfigCheckbox v-model="store.config.HideOnTvLayout" :label="t('display.hideTv')" />
      </ConfigCard>

      <ConfigCard class="ec-displayAutoplayCard" :title="t('display.autoplay')">
        <ConfigCheckbox v-model="store.config.EnableAutoplay" :label="t('display.enableAutoplay')" :help-text="t('display.autoplayHelp')" />
        <ConfigNumber v-if="store.config.EnableAutoplay" v-model="store.config.AutoplayInterval" :label="t('display.intervalSeconds')" :min="1" :max="3600" :step="1" />
        <ConfigCheckbox v-if="store.config.EnableAutoplay" v-model="store.config.ShowAutoplayButton" :label="t('display.showAutoplayControl')" />
        <ConfigNumber v-if="!store.config.EnableInfiniteLoading" v-model="store.config.RandomMediaCount" :label="t('display.maximumSlides')" :min="1" :max="100" :step="1" />
      </ConfigCard>
    </div>
  </section>
</template>
