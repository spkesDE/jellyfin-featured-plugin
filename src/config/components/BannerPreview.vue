<script setup lang="ts">
import { computed } from 'vue';
import { t } from '../../i18n';
import { heroImageUrl, logoUrl } from '../../slider/images';
import { createHeroFadeMask, getHeroDesktopHeight, getHeroOverlap } from '../../slider/layout';
import { useConfigStore } from '../libs/store';
import type { FeaturedItem } from '../../types/featured';

const store = useConfigStore();
const manualItems = computed(() => store.config.ManualLists
  .filter((list) => list.Enabled)
  .flatMap((list) => list.Items));
const item = computed<FeaturedItem | null>(() => {
  const manual = manualItems.value[0];
  return manual
    ? { id: manual.ItemId, name: manual.Name, hasLogo: false, isFavorite: false, isPlayed: false, imageType: manual.ImageType, mediaType: manual.MediaType, overview: null, community_rating: undefined, critic_rating: undefined }
    : store.preview.value?.items?.[0] ?? null;
});
const itemCount = computed(() => manualItems.value.length || store.preview.value?.items?.length || 5);
const desktopHeight = computed(() => getHeroDesktopHeight(store.config.HeroHeightMode, store.config.BannerHeight));
const previewScale = computed(() => store.config.UseHeroLayout ? 0.52 : 0.44);
const heroOverlap = computed(() => getHeroOverlap(desktopHeight.value, store.config.HeroHeightMode));
const previewStyle = computed(() => ({
  height: `${Math.max(190, Math.min(360, desktopHeight.value * previewScale.value))}px`,
  '--ec-preview-radius': store.config.UseHeroLayout ? '0px' : `${store.config.HeroBorderRadius}px`,
  '--ec-preview-gradient': String(store.config.UseHeroLayout ? store.config.HeroGradientStrength / 100 : 0.85),
  '--ec-preview-fade': createHeroFadeMask(
    store.config.HeroFadeStart,
    store.config.HeroFadeEnd,
    store.config.HeroFadeCurve
  )
}));
const mockStyle = computed(() => ({
  '--ec-preview-media-offset': `${Math.max(-90, Math.min(90, (store.config.MediaPadding + (store.config.UseHeroLayout ? 52 - heroOverlap.value : 0)) * previewScale.value))}px`
}));
const backdropStyle = computed(() => item.value ? ({
  backgroundImage: `url("${heroImageUrl(item.value.id, item.value.imageType, store.config.ReduceImageSize).replace(/"/g, '%22')}")`,
  backgroundPosition: store.config.HeroBackdropPosition
}) : undefined);
const logoSource = computed(() => item.value?.hasLogo && store.config.TitleDisplayMode === 'logo'
  ? logoUrl(item.value.id, store.config.ReduceImageSize)
  : '');
const mediaCards = [
  t('preview.movies'),
  t('preview.shows'),
  t('preview.collections'),
  t('preview.music'),
  t('preview.liveTv')
];
</script>

<template>
  <div class="jmp-appearancePreviewItem ec-configPreviewItem">
    <div class="jmp-appearancePreviewLabel">
      <span>{{ item ? t('preview.libraryWithName', { name: item.name }) : t('preview.library') }}</span>
      <span class="jmp-badge jmp-badge-muted">{{ store.config.UseHeroLayout ? t('preview.hero') : t('preview.standard') }}</span>
    </div>
    <div class="ec-jellyfinMock" :style="mockStyle">
      <div class="ec-jellyfinMockHeader">
        <span class="ec-mockIcon">☰</span>
        <strong>Jellyfin</strong>
        <div class="ec-jellyfinMockNav"><span>{{ t('preview.home') }}</span><span>{{ t('preview.favorites') }}</span></div>
        <div class="ec-jellyfinMockHeaderActions">
          <span class="ec-mockIcon">⌕</span>
          <span class="ec-mockIcon">⚙</span>
          <span class="ec-mockIcon">●</span>
        </div>
      </div>
      <div class="ec-jellyfinMockPage">
        <div v-if="store.config.Heading && !store.config.UseHeroLayout" class="ec-jellyfinMockHeading">
          {{ store.config.Heading }}
        </div>
        <div class="ec-configPreview" :class="[`text-${store.config.HeroTextPosition}`, { 'is-hero': store.config.UseHeroLayout, 'controls-on-hover': store.config.ShowControlsOnHoverOnly }]" :style="previewStyle">
          <div class="ec-configPreviewBackdrop" :style="backdropStyle" />
          <div class="ec-configPreviewShade" />
          <div class="ec-configPreviewContent">
            <img v-if="logoSource" class="ec-configPreviewImageLogo" :src="logoSource" :alt="item?.name || ''">
            <div v-else class="ec-configPreviewLogo">{{ item?.name || t('preview.fallbackTitle') }}</div>
            <div v-if="store.config.ShowRating || store.config.ShowYear || store.config.ShowRuntime" class="ec-configPreviewMeta">
              <span v-if="store.config.ShowRating">★ {{ item?.community_rating?.toFixed(1) || '8.7' }}</span>
              <span v-if="store.config.ShowRating && item?.critic_rating">{{ Math.round(item.critic_rating) }}%</span>
              <span v-if="store.config.ShowYear">{{ item?.productionYear || 2026 }}</span>
              <span v-if="store.config.ShowRuntime">{{ item?.runtimeMinutes || 124 }} min</span>
            </div>
            <div v-if="store.config.ShowDescription" class="ec-configPreviewText">
              {{ item?.overview || t('preview.fallbackDescription') }}
            </div>
            <div v-if="store.config.ShowPlayButton || store.config.ShowSecondaryButton || store.config.ShowFavoriteButton" class="ec-configPreviewActions">
              <button v-if="store.config.ShowPlayButton" type="button" class="ec-configPreviewButton raised button-submit emby-button">
                {{ store.config.PlayButtonText || `▶ ${t('common.play')}` }}
              </button>
              <button v-if="store.config.ShowSecondaryButton" type="button" class="ec-configPreviewButton is-secondary raised emby-button">
                {{ store.config.SecondaryButtonText || t('display.moreInfo') }}
              </button>
              <button v-if="store.config.ShowFavoriteButton" type="button" class="ec-configPreviewButton is-secondary is-favorite raised emby-button" :title="t('display.showFavoriteButton')">
                <span class="material-icons" aria-hidden="true">{{ item?.isFavorite ? 'favorite' : 'favorite_border' }}</span>
              </button>
            </div>
          </div>
          <div
            v-if="itemCount > 1 && (store.config.ShowNavigationArrows || (store.config.EnableAutoplay && store.config.ShowAutoplayButton) || (!store.config.EnableInfiniteLoading && (store.config.ShowPaginationDots || store.config.ShowSlidePosition)))"
            class="ec-configPreviewNavigation"
          >
            <div v-if="store.config.ShowNavigationArrows || (store.config.EnableAutoplay && store.config.ShowAutoplayButton) || (!store.config.EnableInfiniteLoading && store.config.ShowSlidePosition && !store.config.ShowPaginationDots)" class="ec-configPreviewControls">
              <span v-if="!store.config.EnableInfiniteLoading && store.config.ShowSlidePosition && !store.config.ShowPaginationDots" class="ec-configPreviewStatus">1 / {{ itemCount }}</span>
              <span v-if="store.config.ShowNavigationArrows" class="ec-mockControl">‹</span>
              <span v-if="store.config.EnableAutoplay && store.config.ShowAutoplayButton" class="ec-mockControl">Ⅱ</span>
              <span v-if="store.config.ShowNavigationArrows" class="ec-mockControl">›</span>
            </div>
            <div v-if="!store.config.EnableInfiniteLoading && store.config.ShowPaginationDots" class="ec-configPreviewDots" aria-hidden="true">
              <span v-for="dot in Math.min(itemCount, 10)" :key="dot" :class="{ 'is-active': dot === 1 }" />
            </div>
          </div>
        </div>
        <div class="ec-jellyfinMockMedia">
          <div class="ec-jellyfinMockHeading">{{ t('preview.myMedia') }}</div>
          <div class="ec-jellyfinMockCards">
            <div v-for="(card, index) in mediaCards" :key="card" class="ec-jellyfinMockCard">
              <div class="ec-jellyfinMockCardArt" :class="'art-' + (index + 1)">
                <span class="ec-mockPlay">▶</span>
              </div>
              <span>{{ card }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
