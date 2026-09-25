import { computed, inject, reactive, ref, type ComputedRef, type InjectionKey, type Ref, type WritableComputedRef } from 'vue';
import { cloneJsonValue } from '../../core/clone';
import { getApiClient, requestJson } from '../../core/apiClient';
import { t } from '../../i18n';
import type { FeaturedFilterRule, FeaturedManualList, FeaturedPluginConfig, FeaturedPreset, FrontendInjectionMethod, SourceType } from '../../types/config';
import type { FeaturedDiagnostics, FeaturedFeedPreview, FeaturedResponse, FeaturedSearchItem } from '../../types/featured';
import { createDefaultConfig, createFilterRule, createManualList, createPresetFromConfig, createSourceRule, createUserProfile, normalizeConfig, refreshPresetFromConfig } from './defaults';
import { loadLibrariesAndCollections, loadRatings, loadUsers } from './jellyfinApi';
import type { ConfigCollection, ConfigLibrary, ConfigPlaylist, ConfigRating, ConfigTab, ConfigUser, SaveState } from './types';

const PLUGIN_ID = '08880a95-8467-4538-bab9-da69c7f4793f';
const snapshot = (value: FeaturedPluginConfig): string => JSON.stringify(value);
const cloneConfig = (value: FeaturedPluginConfig): FeaturedPluginConfig => JSON.parse(snapshot(value)) as FeaturedPluginConfig;

export interface ConfigStore {
  config: FeaturedPluginConfig;
  users: Ref<ConfigUser[]>;
  libraries: Ref<ConfigLibrary[]>;
  collections: Ref<ConfigCollection[]>;
  playlists: Ref<ConfigPlaylist[]>;
  genres: Ref<string[]>;
  tags: Ref<string[]>;
  actors: Ref<string[]>;
  directors: Ref<string[]>;
  originalLanguages: Ref<string[]>;
  audioLanguages: Ref<string[]>;
  ratings: Ref<ConfigRating[]>;
  preview: Ref<FeaturedResponse | null>;
  diagnostics: Ref<FeaturedDiagnostics | null>;
  diagnosticsError: Ref<string | null>;
  diagnosticsLoading: Ref<boolean>;
  injectionMethodsAvailable: Ref<Record<FrontendInjectionMethod, boolean>>;
  feedPreview: Ref<FeaturedFeedPreview | null>;
  feedPreviewOpen: Ref<boolean>;
  feedPreviewLoading: Ref<boolean>;
  feedPreviewError: Ref<string | null>;
  feedPreviewPresetId: Ref<string>;
  feedPreviewUserId: Ref<string>;
  activeTab: Ref<ConfigTab>;
  loading: Ref<boolean>;
  saveState: ComputedRef<SaveState>;
  parentalRatingValue: WritableComputedRef<string>;
  loadConfig(): Promise<void>;
  saveConfig(): Promise<void>;
  runDiagnostics(): Promise<void>;
  openFeedPreview(presetId?: string): Promise<void>;
  closeFeedPreview(): void;
  runFeedPreview(userId?: string, presetId?: string): Promise<void>;
  selectTab(tab: ConfigTab): void;
  addSource(type: SourceType): void;
  removeSource(index: number): void;
  moveSource(index: number, direction: -1 | 1): void;
  addFilter(filters: FeaturedFilterRule[]): void;
  removeFilter(filters: FeaturedFilterRule[], index: number): void;
  addManualList(): void;
  removeManualList(index: number): void;
  addManualItem(list: FeaturedManualList, item: FeaturedSearchItem): void;
  removeManualItem(list: FeaturedManualList, index: number): void;
  moveManualItem(list: FeaturedManualList, from: number, to: number): void;
  addUserProfile(userId: string): void;
  removeUserProfile(index: number): void;
  addPreset(name?: string): void;
  updatePresetSnapshot(index: number): void;
  duplicatePreset(index: number): void;
  removePreset(index: number): void;
  clearDisplayHistory(userIds: string[]): Promise<void>;
}

export function createConfigStore(): ConfigStore {
  const config = reactive(createDefaultConfig()) as FeaturedPluginConfig;
  const users = ref<ConfigUser[]>([]);
  const libraries = ref<ConfigLibrary[]>([]);
  const collections = ref<ConfigCollection[]>([]);
  const playlists = ref<ConfigPlaylist[]>([]);
  const genres = ref<string[]>([]);
  const tags = ref<string[]>([]);
  const actors = ref<string[]>([]);
  const directors = ref<string[]>([]);
  const originalLanguages = ref<string[]>([]);
  const audioLanguages = ref<string[]>([]);
  const ratings = ref<ConfigRating[]>([{ value: '-2,0', label: t('filter.currentUserProfile') }]);
  const preview = ref<FeaturedResponse | null>(null);
  const diagnostics = ref<FeaturedDiagnostics | null>(null);
  const diagnosticsError = ref<string | null>(null);
  const diagnosticsLoading = ref(false);
  const injectionMethodsAvailable = ref<Record<FrontendInjectionMethod, boolean>>({
    automatic: true,
    'file-transformation': false,
    'javascript-injector': false,
    direct: false
  });
  const feedPreview = ref<FeaturedFeedPreview | null>(null);
  const feedPreviewOpen = ref(false);
  const feedPreviewLoading = ref(false);
  const feedPreviewError = ref<string | null>(null);
  const feedPreviewPresetId = ref('');
  const feedPreviewUserId = ref('');
  const activeTab = ref<ConfigTab>('sources');
  const loading = ref(false);
  const lastSaved = ref(snapshot(config));
  const savedFeedback = ref(false);
  let feedbackTimer: number | null = null;
  let configLoadPromise: Promise<void> | null = null;
  let supportingDataPromise: Promise<void> | null = null;
  let previewLoadPromise: Promise<void> | null = null;

  const saveState = computed<SaveState>(() => {
    const dirty = snapshot(config) !== lastSaved.value;
    return savedFeedback.value && !dirty ? 'saved' : dirty ? 'dirty' : 'clean';
  });
  const parentalRatingValue = computed({
    get: () => `${config.MaximumParentRating},${config.MaximumParentRatingSubscore}`,
    set: (value: string) => {
      const [score, subScore] = value.split(',').map(Number);
      config.MaximumParentRating = Number.isFinite(score) ? score : -2;
      config.MaximumParentRatingSubscore = Number.isFinite(subScore) ? subScore : 0;
    }
  });

  async function loadSupportingData(): Promise<void> {
    if (supportingDataPromise) return supportingDataPromise;
    supportingDataPromise = Promise.all([
      loadUsers(),
      loadLibrariesAndCollections(),
      loadRatings()
    ]).then(([loadedUsers, discovery, loadedRatings]) => {
      users.value = loadedUsers;
      libraries.value = discovery.libraries;
      collections.value = discovery.collections;
      playlists.value = discovery.playlists;
      genres.value = discovery.genres;
      tags.value = discovery.tags;
      actors.value = discovery.actors;
      directors.value = discovery.directors;
      originalLanguages.value = discovery.originalLanguages;
      audioLanguages.value = discovery.audioLanguages;
      ratings.value = loadedRatings;
    }).finally(() => {
      supportingDataPromise = null;
    });
    return supportingDataPromise;
  }

  async function loadPreview(force = false): Promise<void> {
    if (previewLoadPromise) return previewLoadPromise;
    if (preview.value && !force) return;
    previewLoadPromise = requestJson<FeaturedResponse>('featured/items')
      .then((response) => {
        preview.value = response.items?.length ? response : null;
      })
      .catch(() => {
        preview.value = null;
      })
      .finally(() => {
        previewLoadPromise = null;
      });
    return previewLoadPromise;
  }

  function loadConfig(): Promise<void> {
    if (configLoadPromise) return configLoadPromise;
    const api = getApiClient();
    if (!api?.getPluginConfiguration) return Promise.resolve();
    loading.value = true;
    window.Dashboard?.showLoadingMsg();
    const primaryLoad = api.getPluginConfiguration(PLUGIN_ID).then((serverConfig) => {
      Object.assign(config, normalizeConfig(serverConfig));
      lastSaved.value = snapshot(config);
      savedFeedback.value = false;
    }).finally(() => {
      loading.value = false;
      window.Dashboard?.hideLoadingMsg();
      configLoadPromise = null;
    });
    configLoadPromise = primaryLoad;
    void requestJson<Record<FrontendInjectionMethod, boolean>>('featured/config/injection-methods')
      .then((availability) => { injectionMethodsAvailable.value = availability; })
      .catch(() => undefined);
    void primaryLoad.then(() => loadSupportingData()).catch(() => undefined);
    return primaryLoad;
  }

  async function saveConfig(): Promise<void> {
    const api = getApiClient();
    if (!api?.updatePluginConfiguration) return;
    loading.value = true;
    window.Dashboard?.showLoadingMsg();
    try {
      const result = await api.updatePluginConfiguration(PLUGIN_ID, cloneConfig(config));
      lastSaved.value = snapshot(config);
      savedFeedback.value = true;
      if (feedbackTimer) window.clearTimeout(feedbackTimer);
      feedbackTimer = window.setTimeout(() => { savedFeedback.value = false; }, 1400);
      window.Dashboard?.processPluginConfigurationUpdateResult(result);
      if (activeTab.value === 'display') void loadPreview(true);
    } finally {
      loading.value = false;
      window.Dashboard?.hideLoadingMsg();
    }
  }

  async function runDiagnostics(): Promise<void> {
    diagnosticsLoading.value = true;
    diagnosticsError.value = null;
    try {
      diagnostics.value = await requestJson<FeaturedDiagnostics>('featured/diagnostics');
    } catch (error) {
      diagnostics.value = null;
      diagnosticsError.value = error instanceof Error ? error.message : String(error);
    } finally {
      diagnosticsLoading.value = false;
    }
  }

  async function runFeedPreview(userId = '', presetId = feedPreviewPresetId.value): Promise<void> {
    feedPreviewLoading.value = true;
    feedPreviewError.value = null;
    feedPreviewPresetId.value = presetId;
    feedPreviewUserId.value = userId;
    try {
      feedPreview.value = await requestJson<FeaturedFeedPreview>('featured/config/preview', {
        method: 'POST',
        body: {
          configuration: cloneConfig(config),
          userId: userId || null,
          presetId: presetId && presetId !== '__default__' ? presetId : null,
          useDefaultConfiguration: presetId === '__default__'
        }
      });
    } catch (error) {
      feedPreview.value = null;
      feedPreviewError.value = error instanceof Error ? error.message : String(error);
    } finally {
      feedPreviewLoading.value = false;
    }
  }

  async function openFeedPreview(presetId = ''): Promise<void> {
    feedPreviewOpen.value = true;
    feedPreviewPresetId.value = presetId;
    await runFeedPreview(feedPreviewUserId.value, presetId);
  }

  function closeFeedPreview(): void {
    feedPreviewOpen.value = false;
  }

  function addSource(type: SourceType): void {
    config.SourceRules.push(createSourceRule(type));
  }
  function removeSource(index: number): void {
    config.SourceRules.splice(index, 1);
  }
  function moveSource(index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (target < 0 || target >= config.SourceRules.length) return;
    const [rule] = config.SourceRules.splice(index, 1);
    config.SourceRules.splice(target, 0, rule);
  }
  function addFilter(filters: FeaturedFilterRule[]): void {
    filters.push(createFilterRule());
  }
  function removeFilter(filters: FeaturedFilterRule[], index: number): void {
    filters.splice(index, 1);
  }
  function addManualList(): void {
    config.ManualLists.push(createManualList(t('manual.defaultName')));
  }
  function removeManualList(index: number): void {
    const [removed] = config.ManualLists.splice(index, 1);
    if (!removed) return;
    config.SourceRules.forEach((rule) => {
      rule.ManualListIds = rule.ManualListIds.filter((id) => id !== removed.Id);
    });
  }
  function addManualItem(list: FeaturedManualList, item: FeaturedSearchItem): void {
    if (list.Items.some((candidate) => candidate.ItemId === item.id)) return;
    list.Items.push({
      Id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      ItemId: item.id, Name: item.name, MediaType: item.mediaType, ProductionYear: item.productionYear ?? null,
      ImageType: item.imageType, Position: list.Items.length, StartsAt: null, EndsAt: null
    });
  }
  function removeManualItem(list: FeaturedManualList, index: number): void {
    list.Items.splice(index, 1);
    list.Items.forEach((item, position) => { item.Position = position; });
  }
  function moveManualItem(list: FeaturedManualList, from: number, to: number): void {
    if (from < 0 || to < 0 || from >= list.Items.length || to >= list.Items.length || from === to) return;
    const [item] = list.Items.splice(from, 1);
    list.Items.splice(to, 0, item);
    list.Items.forEach((candidate, position) => { candidate.Position = position; });
  }
  function addUserProfile(userId: string): void {
    if (!userId || config.UserProfiles.some((profile) => profile.UserId === userId)) return;
    config.UserProfiles.push(createUserProfile(userId));
  }
  function removeUserProfile(index: number): void {
    config.UserProfiles.splice(index, 1);
  }
  function addPreset(name = t('preset.defaultName')): void {
    config.Presets.push(createPresetFromConfig(config, name));
  }
  function updatePresetSnapshot(index: number): void {
    const preset = config.Presets[index];
    if (!preset) return;
    config.Presets.splice(index, 1, refreshPresetFromConfig(preset, config));
  }
  function duplicatePreset(index: number): void {
    const preset = config.Presets[index];
    if (!preset) return;
    const copy = cloneJsonValue(preset) as FeaturedPreset;
    copy.Id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    copy.Name = t('preset.copyName', { name: preset.Name });
    copy.Enabled = false;
    config.Presets.splice(index + 1, 0, copy);
  }
  function removePreset(index: number): void {
    config.Presets.splice(index, 1);
  }
  async function clearDisplayHistory(userIds: string[]): Promise<void> {
    if (!userIds.length) return;
    await requestJson<{ ok: boolean }>('featured/config/history/clear', {
      method: 'POST',
      body: { userIds }
    });
  }
  return {
    config, users, libraries, collections, playlists, genres, tags, actors, directors, originalLanguages, audioLanguages,
    ratings, preview, diagnostics, diagnosticsError, diagnosticsLoading, injectionMethodsAvailable,
    feedPreview, feedPreviewOpen, feedPreviewLoading, feedPreviewError, feedPreviewPresetId, feedPreviewUserId,
    activeTab, loading, saveState, parentalRatingValue,
    loadConfig, saveConfig, runDiagnostics, openFeedPreview, closeFeedPreview, runFeedPreview, selectTab: (tab) => {
      activeTab.value = tab;
      if (tab === 'display') void loadPreview();
    },
    addSource, removeSource, moveSource, addFilter, removeFilter,
    addManualList, removeManualList, addManualItem, removeManualItem, moveManualItem,
    addUserProfile, removeUserProfile,
    addPreset, updatePresetSnapshot, duplicatePreset, removePreset,
    clearDisplayHistory
  };
}

export const configStoreKey: InjectionKey<ConfigStore> = Symbol('featured-config-store');
export function useConfigStore(): ConfigStore {
  const store = inject(configStoreKey);
  if (!store) throw new Error('Jellyfin Featured configuration store was not provided.');
  return store;
}
