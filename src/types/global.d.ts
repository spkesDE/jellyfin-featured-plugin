import type { RuntimeConfig } from './config';
import type { JellyfinApiClient } from './jellyfin';

declare global {
  interface Window {
    JellyfinFeatured?: {
      version: string;
      start(): void;
      destroy(): void;
      refresh(): void;
    };
    JellyfinFeaturedPluginConfig?: RuntimeConfig;
    JellyfinFeaturedBootstrap?: { stop(): void };
    ApiClient?: JellyfinApiClient;
    apiClient?: JellyfinApiClient;
    Emby?: { Page?: { showItem?: (id: string) => void } };
    Dashboard?: {
      showLoadingMsg(): void;
      hideLoadingMsg(): void;
      processPluginConfigurationUpdateResult(result: unknown): void;
      alert?(message: string | { message: string }): void | Promise<void>;
      confirm?(message: string): void;
    };
  }
}

export {};
