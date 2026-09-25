<script setup lang="ts">
import { computed } from 'vue';
import { t } from '../../i18n';
import { heroImageUrl, logoUrl } from '../../slider/images';
import { createHeroFadeMask, getHeroDesktopHeight } from '../../slider/layout';
import { useConfigStore } from '../libs/store';
import type { FeaturedItem } from '../../types/featured';

const store = useConfigStore();
defineEmits<{ focusSection: [section: string] }>();
const manualItems = computed(() => store.config.ManualLists
  .filter((list) => list.Enabled)
  .flatMap((list) => list.Items));
const backendItems = computed(() => store.preview.value?.items ?? []);
const item = computed<FeaturedItem | null>(() => {
  const candidates = backendItems.value;
  if (candidates.length) {
    if (store.config.TitleDisplayMode === 'logo') {
      return candidates.find((candidate) => candidate.hasLogo && candidate.hasImage)
        ?? candidates.find((candidate) => candidate.hasImage)
        ?? candidates[0];
    }
    return candidates.find((candidate) => candidate.hasImage) ?? candidates[0];
  }
  const manual = manualItems.value[0];
  return manual
    ? { id: manual.ItemId, name: manual.Name, hasLogo: false, hasImage: true, isFavorite: false, isPlayed: false, imageType: manual.ImageType, mediaType: manual.MediaType, overview: null, community_rating: undefined, critic_rating: undefined }
    : null;
});
const itemCount = computed(() => backendItems.value.length || manualItems.value.length || 5);
const desktopHeight = computed(() => getHeroDesktopHeight(store.config.HeroHeightMode, store.config.BannerHeight));
const previewScale = computed(() => store.config.UseHeroLayout ? 0.76 : 0.44);
const previewStyle = computed(() => ({
  height: `${Math.max(190, Math.min(360, desktopHeight.value * previewScale.value))}px`,
  '--ec-preview-radius': store.config.UseHeroLayout ? '0px' : `${store.config.HeroBorderRadius}px`,
  '--ec-preview-gradient': String(store.config.UseHeroLayout ? store.config.HeroGradientStrength / 100 : 0.85),
  '--ec-preview-fade': createHeroFadeMask(
    store.config.HeroFadeStart,
    store.config.HeroFadeEnd,
    store.config.HeroFadeCurve,
    store.config.HeroGradientStrength,
    store.config.HeroFadePoints
  )
}));
const mockStyle = computed(() => ({
  '--ec-preview-media-offset': `${Math.max(-90, Math.min(90, store.config.MediaPadding * previewScale.value))}px`
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
const libraryItems = computed(() => backendItems.value.filter((entry) => entry.hasImage));
function mediaCardStyle(index: number): Record<string, string> | undefined {
  const cards = libraryItems.value;
  if (!cards.length) return undefined;
  const cardItem = cards[(index + 1) % cards.length];
  const image = heroImageUrl(cardItem.id, cardItem.imageType, true).replace(/"/g, '%22');
  return { backgroundImage: `url("${image}")` };
}
</script>

<template>
  <div class="jmp-appearancePreviewItem ec-configPreviewItem">
    <div class="jmp-appearancePreviewLabel">
      <span>{{ item ? t('preview.libraryWithName', { name: item.name }) : t('preview.library') }}</span>
      <span class="jmp-badge jmp-badge-muted">{{ store.config.UseHeroLayout ? t('preview.hero') : t('preview.standard') }}</span>
    </div>
    <div class="ec-jellyfinMock" :style="mockStyle">
      <div class="ec-jellyfinMockHeader">
        <div class="ec-jellyfinMockBrand">
          <svg class="ec-jellyfinMockBrandLogo" viewBox="0 0 72 72" role="img" aria-label="Jellyfin">
            <defs>
              <linearGradient id="ec-jellyfin-logo-inner" x1="12" y1="30" x2="72" y2="63" gradientUnits="userSpaceOnUse">
                <stop stop-color="#aa5cc3" />
                <stop offset="1" stop-color="#00a4dc" />
              </linearGradient>
              <linearGradient id="ec-jellyfin-logo-outer" x1="12" y1="30" x2="72" y2="63" gradientUnits="userSpaceOnUse">
                <stop stop-color="#aa5cc3" />
                <stop offset="1" stop-color="#00a4dc" />
              </linearGradient>
            </defs>
            <path d="M24.2116 49.1581C22.6599 46.0424 32.8378 27.5879 35.9999 27.5879C39.1666 27.5895 49.3228 46.0764 47.7882 49.1581C46.2536 52.2398 25.7632 52.2738 24.2116 49.1581Z" fill="url(#ec-jellyfin-logo-inner)" />
            <path fill-rule="evenodd" clip-rule="evenodd" d="M0.481861 64.9951C-4.19479 55.6047 26.4765 0 36 0C45.5328 0 76.153 55.713 71.5274 64.9951C66.9018 74.2773 5.15852 74.3856 0.481861 64.9951ZM12.7358 56.847C15.8005 62.9995 56.2536 62.9314 59.2843 56.847C62.3149 50.761 42.2515 14.2605 36.0093 14.2605C29.767 14.2605 9.67118 50.6944 12.7358 56.847Z" fill="url(#ec-jellyfin-logo-outer)" />
          </svg>
          <strong>Jellyfin</strong>
        </div>
        <div class="ec-jellyfinMockNav">
          <span class="is-active"><span class="material-icons" aria-hidden="true">home</span>{{ t('preview.home') }}</span>
          <span><span class="material-icons" aria-hidden="true">favorite</span>{{ t('preview.favorites') }}</span>
          <span><span class="material-icons" aria-hidden="true">movie</span>{{ t('preview.movies') }}</span>
          <span><span class="material-icons" aria-hidden="true">tv</span>{{ t('preview.shows') }}</span>
        </div>
        <div class="ec-jellyfinMockHeaderActions">
          <span class="material-icons ec-mockIcon">cast</span>
          <span class="material-icons ec-mockIcon">search</span>
          <span class="ec-jellyfinMockAvatar">J</span>
        </div>
      </div>
      <div class="ec-jellyfinMockPage">
        <div v-if="store.config.Heading && !store.config.UseHeroLayout" class="ec-jellyfinMockHeading">
          {{ store.config.Heading }}
        </div>
        <div class="ec-configPreview" :class="[`text-${store.config.HeroTextPosition}`, { 'is-hero': store.config.UseHeroLayout, 'controls-on-hover': store.config.ShowControlsOnHoverOnly }]" :style="previewStyle" @click="$emit('focusSection', 'layout')">
          <div class="ec-configPreviewBackdrop" :style="backdropStyle" />
          <div class="ec-configPreviewShade" />
          <div class="ec-configPreviewContent">
            <img v-if="logoSource" class="ec-configPreviewImageLogo" :src="logoSource" :alt="item?.name || ''">
            <div v-else class="ec-configPreviewLogo">{{ item?.name || t('preview.fallbackTitle') }}</div>
            <div v-if="store.config.ShowRating || store.config.ShowYear || store.config.ShowRuntime || (store.config.ShowFavoriteButton && store.config.FavoriteButtonPlacement === 'metadata') || (store.config.ShowPlaystateButton && store.config.PlaystateButtonPlacement === 'metadata') || (store.config.DismissalPolicy.Enabled && store.config.ShowDismissalButton && store.config.DismissalButtonPlacement === 'metadata')" class="ec-configPreviewMeta" @click.stop="$emit('focusSection', 'metadata')">
              <span v-if="store.config.ShowRating">★ {{ item?.community_rating?.toFixed(1) || '8.7' }}</span>
              <span v-if="store.config.ShowRating">{{ item?.critic_rating ? Math.round(item.critic_rating) : 92 }}%</span>
              <span v-if="store.config.ShowRating">{{ item?.official_rating || 'FSK 12' }}</span>
              <span v-if="store.config.ShowYear">{{ item?.productionYear || 2026 }}</span>
              <span v-if="store.config.ShowRuntime">{{ item?.runtimeMinutes || 124 }} min</span>
              <button v-if="store.config.ShowFavoriteButton && store.config.FavoriteButtonPlacement === 'metadata'" type="button" class="ec-configPreviewMetaControl" :title="t('display.showFavoriteButton')"><span class="material-icons" aria-hidden="true">{{ item?.isFavorite ? 'favorite' : 'favorite_border' }}</span></button>
              <button v-if="store.config.ShowPlaystateButton && store.config.PlaystateButtonPlacement === 'metadata'" type="button" class="ec-configPreviewMetaControl" :title="t('display.showPlaystateButton')"><span class="material-icons" aria-hidden="true">check</span></button>
              <button v-if="store.config.DismissalPolicy.Enabled && store.config.ShowDismissalButton && store.config.DismissalButtonPlacement === 'metadata'" type="button" class="ec-configPreviewMetaControl" :title="t('display.showDismissalButton')"><span class="material-icons" aria-hidden="true">visibility_off</span></button>
            </div>
            <div v-if="store.config.ShowDescription" class="ec-configPreviewText">
              {{ item?.overview || t('preview.fallbackDescription') }}
            </div>
            <div v-if="store.config.ShowPlayButton || store.config.ShowSecondaryButton || (store.config.ShowFavoriteButton && store.config.FavoriteButtonPlacement === 'actions') || (store.config.ShowPlaystateButton && store.config.PlaystateButtonPlacement === 'actions') || (store.config.DismissalPolicy.Enabled && store.config.ShowDismissalButton && store.config.DismissalButtonPlacement === 'actions')" class="ec-configPreviewActions" @click.stop="$emit('focusSection', 'actions')">
              <button v-if="store.config.ShowPlayButton" type="button" class="ec-configPreviewButton raised button-submit emby-button">
                {{ store.config.PlayButtonText || `▶ ${t('common.play')}` }}
              </button>
              <button v-if="store.config.ShowSecondaryButton" type="button" class="ec-configPreviewButton is-secondary raised emby-button">
                {{ store.config.SecondaryButtonText || t('display.moreInfo') }}
              </button>
              <button v-if="store.config.ShowFavoriteButton && store.config.FavoriteButtonPlacement === 'actions'" type="button" class="ec-configPreviewButton is-secondary is-favorite raised emby-button" :title="t('display.showFavoriteButton')">
                <span class="material-icons" aria-hidden="true">{{ item?.isFavorite ? 'favorite' : 'favorite_border' }}</span>
              </button>
              <button v-if="store.config.ShowPlaystateButton && store.config.PlaystateButtonPlacement === 'actions'" type="button" class="ec-configPreviewButton is-secondary raised emby-button" :title="t('display.showPlaystateButton')"><span class="material-icons" aria-hidden="true">check</span></button>
              <button v-if="store.config.DismissalPolicy.Enabled && store.config.ShowDismissalButton && store.config.DismissalButtonPlacement === 'actions'" type="button" class="ec-configPreviewButton is-secondary raised emby-button" :title="t('display.showDismissalButton')"><span class="material-icons" aria-hidden="true">visibility_off</span></button>
            </div>
          </div>
          <div
            v-if="itemCount > 1 && (store.config.ShowNavigationArrows || (store.config.EnableAutoplay && store.config.ShowAutoplayButton) || (store.config.EnableBackgroundTrailers && store.config.ShowTrailerControls) || (!store.config.EnableInfiniteLoading && (store.config.ShowPaginationDots || store.config.ShowSlidePosition)))"
            class="ec-configPreviewNavigation" @click.stop="$emit('focusSection', 'navigation')"
          >
            <div v-if="store.config.ShowNavigationArrows || (store.config.EnableAutoplay && store.config.ShowAutoplayButton) || (store.config.EnableBackgroundTrailers && store.config.ShowTrailerControls) || (!store.config.EnableInfiniteLoading && store.config.ShowSlidePosition && !store.config.ShowPaginationDots)" class="ec-configPreviewControls">
              <span v-if="!store.config.EnableInfiniteLoading && store.config.ShowSlidePosition && !store.config.ShowPaginationDots" class="ec-configPreviewStatus">1 / {{ itemCount }}</span>
              <span v-if="store.config.ShowNavigationArrows" class="ec-mockControl">‹</span>
              <span v-if="store.config.EnableAutoplay && store.config.ShowAutoplayButton" class="ec-mockControl">Ⅱ</span>
              <span v-if="store.config.ShowNavigationArrows" class="ec-mockControl">›</span>
              <span v-if="store.config.EnableBackgroundTrailers && store.config.ShowTrailerControls" class="ec-mockControl material-icons">volume_off</span>
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
              <div class="ec-jellyfinMockCardArt" :class="'art-' + (index + 1)" :style="mediaCardStyle(index)">
                <span>{{ card }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ec-configPreviewMetaControl { align-items: center; background: transparent; border: 0; color: inherit; display: inline-flex; padding: 0; }
.ec-configPreviewMetaControl .material-icons { font-size: 1.15em; }
</style>
