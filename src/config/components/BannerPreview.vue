<script setup lang="ts">
import { computed } from 'vue';
import { t } from '../../i18n';
import { heroImageUrl, logoUrl } from '../../slider/images';
import { createHeroFadeMask, getHeroDesktopHeight } from '../../slider/layout';
import { useConfigStore } from '../libs/store';
import type { BannerControlPosition } from '../../types/config';
import type { FeaturedItem } from '../../types/featured';

const store = useConfigStore();
defineEmits<{ focusSection: [section: string] }>();
const manualItems = computed(() =>
  store.config.ManualLists.filter((list) => list.Enabled).flatMap((list) => list.Items)
);
const backendItems = computed(() => store.preview.value?.items ?? []);
const item = computed<FeaturedItem | null>(() => {
  const candidates = backendItems.value;
  if (candidates.length) {
    if (store.config.TitleDisplayMode === 'logo') {
      return (
        candidates.find((candidate) => candidate.hasLogo && candidate.hasImage) ??
        candidates.find((candidate) => candidate.hasImage) ??
        candidates[0]
      );
    }
    return candidates.find((candidate) => candidate.hasImage) ?? candidates[0];
  }
  const manual = manualItems.value[0];
  return manual
    ? {
        id: manual.ItemId,
        name: manual.Name,
        hasLogo: false,
        hasImage: true,
        isFavorite: false,
        isPlayed: false,
        imageType: manual.ImageType,
        mediaType: manual.MediaType,
        overview: null,
        community_rating: undefined,
        critic_rating: undefined
      }
    : null;
});
const itemCount = computed(() => backendItems.value.length || manualItems.value.length || 5);
const desktopHeight = computed(() => getHeroDesktopHeight(store.config.HeroHeightMode, store.config.BannerHeight));
const previewScale = computed(() => (store.config.UseHeroLayout ? 0.76 : 0.44));
const previewStyle = computed(() => ({
  height: `${Math.max(190, Math.min(360, desktopHeight.value * previewScale.value))}px`,
  '--featured-preview-radius': store.config.UseHeroLayout ? '0px' : `${store.config.HeroBorderRadius}px`,
  '--featured-preview-gradient': String(store.config.UseHeroLayout ? store.config.HeroGradientStrength / 100 : 0.85),
  '--featured-preview-fade': createHeroFadeMask(
    store.config.HeroFadeStart,
    store.config.HeroFadeEnd,
    store.config.HeroFadeCurve,
    store.config.HeroGradientStrength,
    store.config.HeroFadePoints
  )
}));
const mockStyle = computed(() => ({
  '--featured-preview-media-offset': `${Math.max(-90, Math.min(90, store.config.MediaPadding * previewScale.value))}px`
}));
const backdropStyle = computed(() =>
  item.value
    ? {
        backgroundImage: `url("${heroImageUrl(item.value.id, item.value.imageType, store.config.ReduceImageSize).replace(/"/g, '%22')}")`,
        backgroundPosition: store.config.HeroBackdropPosition
      }
    : undefined
);
const logoSource = computed(() =>
  item.value?.hasLogo && store.config.TitleDisplayMode === 'logo'
    ? logoUrl(item.value.id, store.config.ReduceImageSize)
    : ''
);
const mediaCards = [
  t('preview.movies'),
  t('preview.shows'),
  t('preview.collections'),
  t('preview.music'),
  t('preview.liveTv')
];
const libraryItems = computed(() => backendItems.value.filter((entry) => entry.hasImage));
const showMetadataFavorite = computed(
  () => store.config.ShowFavoriteButton && store.config.FavoriteButtonPlacement === 'metadata'
);
const showMetadataPlaystate = computed(
  () => store.config.ShowPlaystateButton && store.config.PlaystateButtonPlacement === 'metadata'
);
const showMetadataDismissal = computed(
  () =>
    store.config.DismissalPolicy.Enabled &&
    store.config.ShowDismissalButton &&
    store.config.DismissalButtonPlacement === 'metadata'
);
const showMetadata = computed(
  () =>
    store.config.ShowRating ||
    store.config.ShowYear ||
    store.config.ShowRuntime ||
    showMetadataFavorite.value ||
    showMetadataPlaystate.value ||
    showMetadataDismissal.value
);
const showActionFavorite = computed(
  () => store.config.ShowFavoriteButton && store.config.FavoriteButtonPlacement === 'actions'
);
const showActionPlaystate = computed(
  () => store.config.ShowPlaystateButton && store.config.PlaystateButtonPlacement === 'actions'
);
const showActionDismissal = computed(
  () =>
    store.config.DismissalPolicy.Enabled &&
    store.config.ShowDismissalButton &&
    store.config.DismissalButtonPlacement === 'actions'
);
const showActions = computed(
  () =>
    store.config.ShowPlayButton ||
    store.config.ShowSecondaryButton ||
    showActionFavorite.value ||
    showActionPlaystate.value ||
    showActionDismissal.value
);
const showAutoplayControl = computed(() => store.config.EnableAutoplay && store.config.ShowAutoplayButton);
const showTrailerControl = computed(() => store.config.EnableBackgroundTrailers && store.config.ShowTrailerControls);
const showSlidePosition = computed(
  () => !store.config.EnableInfiniteLoading && store.config.ShowSlidePosition && !store.config.ShowPaginationDots
);
const showNavigationControls = computed(
  () => store.config.ShowNavigationArrows || showAutoplayControl.value || showSlidePosition.value
);
type PreviewControlPosition = BannerControlPosition | 'hero';
const bannerControlPositions: BannerControlPosition[] = ['bottom-center', 'top-right', 'center'];
const previewControlPositions = computed<PreviewControlPosition[]>(() =>
  store.config.UseHeroLayout ? ['hero'] : bannerControlPositions
);
const showPagination = computed(() => !store.config.EnableInfiniteLoading && store.config.ShowPaginationDots);
const showNavigation = computed(
  () => itemCount.value > 1 && (showNavigationControls.value || showTrailerControl.value || showPagination.value)
);
function showsNavigationAt(position: PreviewControlPosition): boolean {
  return showNavigationControls.value && (position === 'hero' || position === store.config.BannerNavigationPosition);
}
function showsMediaAt(position: PreviewControlPosition): boolean {
  return showTrailerControl.value && (position === 'hero' || position === store.config.BannerMediaControlsPosition);
}
function showsPaginationAt(position: PreviewControlPosition): boolean {
  return showPagination.value && (position === 'hero' || position === 'bottom-center');
}
function mediaCardStyle(index: number): Record<string, string> | undefined {
  const cards = libraryItems.value;
  if (!cards.length) return undefined;
  const cardItem = cards[(index + 1) % cards.length];
  const image = heroImageUrl(cardItem.id, cardItem.imageType, true).replace(/"/g, '%22');
  return { backgroundImage: `url("${image}")` };
}
</script>

<template>
  <div class="jmp-appearancePreviewItem featured-configPreviewItem">
    <div class="jmp-appearancePreviewLabel">
      <span>{{ item ? t('preview.libraryWithName', { name: item.name }) : t('preview.library') }}</span>
      <span class="jmp-badge jmp-badge-muted">{{
        store.config.UseHeroLayout ? t('preview.hero') : t('preview.standard')
      }}</span>
    </div>
    <div class="featured-jellyfinMock" :style="mockStyle">
      <div class="featured-jellyfinMockHeader">
        <div class="featured-jellyfinMockBrand">
          <svg class="featured-jellyfinMockBrandLogo" viewBox="0 0 72 72" role="img" aria-label="Jellyfin">
            <defs>
              <linearGradient
                id="featured-jellyfin-logo-inner"
                x1="12"
                y1="30"
                x2="72"
                y2="63"
                gradientUnits="userSpaceOnUse"
              >
                <stop stop-color="#aa5cc3" />
                <stop offset="1" stop-color="#00a4dc" />
              </linearGradient>
              <linearGradient
                id="featured-jellyfin-logo-outer"
                x1="12"
                y1="30"
                x2="72"
                y2="63"
                gradientUnits="userSpaceOnUse"
              >
                <stop stop-color="#aa5cc3" />
                <stop offset="1" stop-color="#00a4dc" />
              </linearGradient>
            </defs>
            <path
              d="M24.2116 49.1581C22.6599 46.0424 32.8378 27.5879 35.9999 27.5879C39.1666 27.5895 49.3228 46.0764 47.7882 49.1581C46.2536 52.2398 25.7632 52.2738 24.2116 49.1581Z"
              fill="url(#featured-jellyfin-logo-inner)"
            />
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M0.481861 64.9951C-4.19479 55.6047 26.4765 0 36 0C45.5328 0 76.153 55.713 71.5274 64.9951C66.9018 74.2773 5.15852 74.3856 0.481861 64.9951ZM12.7358 56.847C15.8005 62.9995 56.2536 62.9314 59.2843 56.847C62.3149 50.761 42.2515 14.2605 36.0093 14.2605C29.767 14.2605 9.67118 50.6944 12.7358 56.847Z"
              fill="url(#featured-jellyfin-logo-outer)"
            />
          </svg>
          <strong>Jellyfin</strong>
        </div>
        <div class="featured-jellyfinMockNav">
          <span class="is-active"
            ><span class="material-icons" aria-hidden="true">home</span>{{ t('preview.home') }}</span
          >
          <span><span class="material-icons" aria-hidden="true">favorite</span>{{ t('preview.favorites') }}</span>
          <span><span class="material-icons" aria-hidden="true">movie</span>{{ t('preview.movies') }}</span>
          <span><span class="material-icons" aria-hidden="true">tv</span>{{ t('preview.shows') }}</span>
        </div>
        <div class="featured-jellyfinMockHeaderActions">
          <span class="material-icons featured-mockIcon">cast</span>
          <span class="material-icons featured-mockIcon">search</span>
          <span class="featured-jellyfinMockAvatar">J</span>
        </div>
      </div>
      <div class="featured-jellyfinMockPage">
        <div v-if="store.config.Heading && !store.config.UseHeroLayout" class="featured-jellyfinMockHeading">
          {{ store.config.Heading }}
        </div>
        <div
          class="featured-configPreview"
          :class="[
            `text-${store.config.HeroTextPosition}`,
            { 'is-hero': store.config.UseHeroLayout, 'controls-on-hover': store.config.ShowControlsOnHoverOnly }
          ]"
          :style="previewStyle"
          @click="$emit('focusSection', 'layout')"
        >
          <div class="featured-configPreviewBackdrop" :style="backdropStyle" />
          <div class="featured-configPreviewShade" />
          <div class="featured-configPreviewContent">
            <img v-if="logoSource" class="featured-configPreviewImageLogo" :src="logoSource" :alt="item?.name || ''" />
            <div v-else class="featured-configPreviewLogo">{{ item?.name || t('preview.fallbackTitle') }}</div>
            <div v-if="showMetadata" class="featured-configPreviewMeta" @click.stop="$emit('focusSection', 'metadata')">
              <span v-if="store.config.ShowRating">★ {{ item?.community_rating?.toFixed(1) || '8.7' }}</span>
              <span v-if="store.config.ShowRating"
                >{{ item?.critic_rating ? Math.round(item.critic_rating) : 92 }}%</span
              >
              <span v-if="store.config.ShowRating">{{ item?.official_rating || 'FSK 12' }}</span>
              <span v-if="store.config.ShowYear">{{ item?.productionYear || 2026 }}</span>
              <span v-if="store.config.ShowRuntime">{{ item?.runtimeMinutes || 124 }} min</span>
              <button
                v-if="showMetadataFavorite"
                type="button"
                class="featured-configPreviewMetaControl"
                :title="t('display.showFavoriteButton')"
              >
                <span class="material-icons" aria-hidden="true">{{
                  item?.isFavorite ? 'favorite' : 'favorite_border'
                }}</span>
              </button>
              <button
                v-if="showMetadataPlaystate"
                type="button"
                class="featured-configPreviewMetaControl"
                :title="t('display.showPlaystateButton')"
              >
                <span class="material-icons" aria-hidden="true">check</span>
              </button>
              <button
                v-if="showMetadataDismissal"
                type="button"
                class="featured-configPreviewMetaControl"
                :title="t('display.showDismissalButton')"
              >
                <span class="material-icons" aria-hidden="true">visibility_off</span>
              </button>
            </div>
            <div v-if="store.config.ShowDescription" class="featured-configPreviewText">
              {{ item?.overview || t('preview.fallbackDescription') }}
            </div>
            <div
              v-if="showActions"
              class="featured-configPreviewActions"
              @click.stop="$emit('focusSection', 'actions')"
            >
              <button
                v-if="store.config.ShowPlayButton"
                type="button"
                class="featured-configPreviewButton raised button-submit emby-button"
              >
                {{ store.config.PlayButtonText || `▶ ${t('common.play')}` }}
              </button>
              <button
                v-if="store.config.ShowSecondaryButton"
                type="button"
                class="featured-configPreviewButton is-secondary raised emby-button"
              >
                {{ store.config.SecondaryButtonText || t('display.moreInfo') }}
              </button>
              <button
                v-if="showActionFavorite"
                type="button"
                class="featured-configPreviewButton is-secondary is-favorite raised emby-button"
                :title="t('display.showFavoriteButton')"
              >
                <span class="material-icons" aria-hidden="true">{{
                  item?.isFavorite ? 'favorite' : 'favorite_border'
                }}</span>
              </button>
              <button
                v-if="showActionPlaystate"
                type="button"
                class="featured-configPreviewButton is-secondary raised emby-button"
                :title="t('display.showPlaystateButton')"
              >
                <span class="material-icons" aria-hidden="true">check</span>
              </button>
              <button
                v-if="showActionDismissal"
                type="button"
                class="featured-configPreviewButton is-secondary raised emby-button"
                :title="t('display.showDismissalButton')"
              >
                <span class="material-icons" aria-hidden="true">visibility_off</span>
              </button>
            </div>
          </div>
          <div
            v-if="showNavigation"
            class="featured-configPreviewNavigation"
            @click.stop="$emit('focusSection', 'navigation')"
          >
            <div
              v-for="position in previewControlPositions"
              :key="position"
              class="featured-configPreviewControlSlot"
              :class="`featured-configPreviewControlSlot-${position}`"
            >
              <div v-if="showsNavigationAt(position)" class="featured-configPreviewControls">
                <span v-if="showSlidePosition" class="featured-configPreviewStatus">1 / {{ itemCount }}</span>
                <span v-if="store.config.ShowNavigationArrows" class="featured-mockControl">‹</span>
                <span v-if="showAutoplayControl" class="featured-mockControl">Ⅱ</span>
                <span v-if="store.config.ShowNavigationArrows" class="featured-mockControl">›</span>
              </div>
              <div v-if="showsMediaAt(position)" class="featured-configPreviewControls">
                <span class="featured-mockControl">Ⅱ</span>
                <span class="featured-mockControl material-icons">volume_off</span>
              </div>
              <div v-if="showsPaginationAt(position)" class="featured-configPreviewDots" aria-hidden="true">
                <span v-for="dot in Math.min(itemCount, 10)" :key="dot" :class="{ 'is-active': dot === 1 }" />
              </div>
            </div>
          </div>
        </div>
        <div class="featured-jellyfinMockMedia">
          <div class="featured-jellyfinMockHeading">{{ t('preview.myMedia') }}</div>
          <div class="featured-jellyfinMockCards">
            <div v-for="(card, index) in mediaCards" :key="card" class="featured-jellyfinMockCard">
              <div class="featured-jellyfinMockCardArt" :class="'art-' + (index + 1)" :style="mediaCardStyle(index)">
                <span>{{ card }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style src="./BannerPreview.css"></style>

<style scoped>
.featured-configPreviewMetaControl {
  align-items: center;
  background: transparent;
  border: 0;
  color: inherit;
  display: inline-flex;
  padding: 0;
}
.featured-configPreviewMetaControl .material-icons {
  font-size: 1.15em;
}
</style>
