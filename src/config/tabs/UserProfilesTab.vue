<script setup lang="ts">
import { computed } from 'vue';
import { t, type TranslationKey } from '../../i18n';
import ConfigActionMenu, { type ConfigMenuAction } from '../components/ConfigActionMenu.vue';
import ConfigCard from '../components/ConfigCard.vue';
import ConfigGrid from '../components/ConfigGrid.vue';
import ConfigListHeader from '../components/ConfigListHeader.vue';
import ConfigMultiPicker from '../components/ConfigMultiPicker.vue';
import ConfigNumber from '../components/ConfigNumber.vue';
import ConfigSection from '../components/ConfigSection.vue';
import ConfigSwitch from '../components/ConfigSwitch.vue';
import { useConfigStore } from '../libs/store';
import { valueOptions } from '../libs/options';
import { openPreferencesDialog } from '../../preferences';
import preferencesCss from '../../styles/featured-preferences.css?inline';

type BoostKey = 'UnplayedBoost' | 'FavouriteBoost' | 'PreferredGenreBoost' | 'InProgressSeriesBoost';

const store = useConfigStore();
const genreOptions = () => valueOptions(store.genres.value);
const profileActions = computed((): ConfigMenuAction[] =>
  store.users.value.map((user) => ({ id: user.Id, label: user.Name, icon: 'person' }))
);

async function openUserProfile(userId: string): Promise<void> {
  const user = store.users.value.find((candidate) => candidate.Id === userId);
  if (!user) return;
  if (!document.getElementById('featured-preferences-admin-styles')) {
    const style = document.createElement('style');
    style.id = 'featured-preferences-admin-styles';
    style.textContent = preferencesCss;
    document.head.appendChild(style);
  }
  await openPreferencesDialog({ userId: user.Id, userName: user.Name });
}

/** Turns both user-facing features on or off together; each keeps its own switch for finer control. */
const allowCustomization = computed({
  get: () => store.config.DismissalPolicy.Enabled || store.config.PersonalizationPolicy.Enabled,
  set: (value: boolean) => {
    store.config.DismissalPolicy.Enabled = value;
    store.config.PersonalizationPolicy.Enabled = value;
  }
});

const boosts: { key: BoostKey; label: TranslationKey }[] = [
  { key: 'UnplayedBoost', label: 'users.unplayedBoost' },
  { key: 'FavouriteBoost', label: 'users.favouriteBoost' },
  { key: 'PreferredGenreBoost', label: 'users.genreBoost' },
  { key: 'InProgressSeriesBoost', label: 'users.inProgressBoost' }
];
</script>

<template>
  <section
    id="featuredPanel-users"
    class="jmp-section jmp-section-plain"
    role="tabpanel"
    aria-labelledby="featuredTab-users"
  >
    <ConfigListHeader
      :title="t('users.title')"
      :help-text="t('users.help')"
      :summary="
        store.users.value.length ? t('users.userCount', { count: store.users.value.length }) : t('users.noUsers')
      "
    >
      <template #actions>
        <ConfigActionMenu
          v-if="store.users.value.length"
          :label="t('users.openProfile')"
          :trigger-text="t('users.openProfile')"
          trigger-icon="manage_accounts"
          :actions="profileActions"
          @select="openUserProfile"
        />
      </template>
    </ConfigListHeader>

    <div class="featured-userSettingsLayout">
      <ConfigCard :title="t('users.permissionsTitle')" :help="t('users.personalizationHelp')">
        <template #actions>
          <ConfigSwitch v-model="allowCustomization" :label="t('users.permissionsTitle')" hide-label />
        </template>
        <div class="featured-userPermissions" :class="{ 'is-disabled': !allowCustomization }">
          <ConfigSection :title="t('users.dismissalsTitle')" :help-text="t('users.dismissalsHelp')">
            <template #actions>
              <ConfigSwitch
                v-model="store.config.DismissalPolicy.Enabled"
                :label="t('users.dismissalsEnabled')"
                hide-label
              />
            </template>
            <div :class="{ 'is-disabled': !store.config.DismissalPolicy.Enabled }">
              <ConfigSwitch
                v-model="store.config.DismissalPolicy.AllowTitle"
                :label="t('users.dismissTitle')"
                :disabled="!store.config.DismissalPolicy.Enabled"
              />
              <ConfigSwitch
                v-model="store.config.DismissalPolicy.AllowSeries"
                :label="t('users.dismissSeries')"
                :disabled="!store.config.DismissalPolicy.Enabled"
              />
              <ConfigSwitch
                v-model="store.config.DismissalPolicy.AllowFranchise"
                :label="t('users.dismissFranchise')"
                :disabled="!store.config.DismissalPolicy.Enabled"
              />
            </div>
          </ConfigSection>

          <ConfigSection :title="t('users.personalizationTitle')">
            <template #actions>
              <ConfigSwitch
                v-model="store.config.PersonalizationPolicy.Enabled"
                :label="t('users.personalizationEnabled')"
                hide-label
              />
            </template>
            <div :class="{ 'is-disabled': !store.config.PersonalizationPolicy.Enabled }">
              <ConfigSwitch
                v-model="store.config.PersonalizationPolicy.AllowSourceSelection"
                :label="t('users.allowSources')"
                :disabled="!store.config.PersonalizationPolicy.Enabled"
              />
              <ConfigSwitch
                v-model="store.config.PersonalizationPolicy.AllowSourceWeights"
                :label="t('users.allowWeights')"
                :disabled="!store.config.PersonalizationPolicy.Enabled"
              />
              <ConfigSwitch
                v-model="store.config.PersonalizationPolicy.AllowPreferredGenres"
                :label="t('users.allowGenres')"
                :disabled="!store.config.PersonalizationPolicy.Enabled"
              />
              <ConfigSwitch
                v-model="store.config.PersonalizationPolicy.AllowUnplayedBoost"
                :label="t('users.allowUnplayed')"
                :disabled="!store.config.PersonalizationPolicy.Enabled"
              />
              <ConfigSwitch
                v-model="store.config.PersonalizationPolicy.AllowFavouriteBoost"
                :label="t('users.allowFavourites')"
                :disabled="!store.config.PersonalizationPolicy.Enabled"
              />
              <ConfigSwitch
                v-model="store.config.PersonalizationPolicy.AllowInProgressSeriesBoost"
                :label="t('users.allowInProgress')"
                :disabled="!store.config.PersonalizationPolicy.Enabled"
              />
              <ConfigSwitch
                v-model="store.config.PersonalizationPolicy.AllowRepeatCooldown"
                :label="t('users.allowCooldown')"
                :disabled="!store.config.PersonalizationPolicy.Enabled"
              />
            </div>
          </ConfigSection>
        </div>
      </ConfigCard>

      <ConfigCard :title="t('users.defaultsTitle')" :help="t('users.defaultsHelp')">
        <ol class="featured-userFlow" :aria-label="t('users.howItWorks')">
          <li>{{ t('users.flowSelect') }}</li>
          <li>{{ t('users.flowScore') }}</li>
          <li>{{ t('users.flowOrder') }}</li>
        </ol>
        <ConfigMultiPicker
          v-model="store.config.PersonalizationDefaults.PreferredGenres"
          :label="t('users.preferredGenres')"
          :options="genreOptions()"
        />
        <ConfigGrid :columns="2">
          <ConfigNumber
            v-for="boost in boosts"
            :key="boost.key"
            v-model="store.config.PersonalizationDefaults[boost.key]"
            :label="t(boost.label)"
            :min="0"
            :max="100"
            :step="1"
          />
        </ConfigGrid>
      </ConfigCard>
    </div>
  </section>
</template>

<style scoped>
.featured-userSettingsLayout {
  align-items: start;
  display: grid;
  gap: 1rem;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  margin-bottom: 1rem;
}
.featured-userSettingsLayout > :deep(.jmp-subsection) {
  margin-bottom: 0;
}
.featured-userPermissions {
  display: grid;
  gap: 0 2rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.featured-userPermissions > :deep(.featured-configSection) {
  border-top: 0;
  padding-top: 0;
}
.featured-userPermissions .is-disabled,
.featured-userPermissions.is-disabled {
  opacity: 0.55;
}

@media (max-width: 1000px) {
  .featured-userSettingsLayout {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 700px) {
  .featured-userPermissions {
    grid-template-columns: minmax(0, 1fr);
  }
}
.featured-userFlow {
  counter-reset: flow;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 0.5rem;
  list-style: none;
  margin: 0 0 1rem;
  padding: 0;
}
.featured-userFlow li {
  align-items: center;
  background: var(--featured-theme-action-hover);
  border: 1px solid var(--featured-theme-divider);
  border-radius: 999px;
  counter-increment: flow;
  display: inline-flex;
  font-size: 0.82rem;
  gap: 0.4rem;
  padding: 0.25rem 0.7rem 0.25rem 0.3rem;
}
.featured-userFlow li::before {
  align-items: center;
  background: var(--featured-theme-primary);
  border-radius: 50%;
  color: var(--featured-theme-primary-contrast);
  content: counter(flow);
  display: inline-flex;
  font-size: 0.72rem;
  font-weight: 700;
  height: 1.2rem;
  justify-content: center;
  width: 1.2rem;
}
</style>
