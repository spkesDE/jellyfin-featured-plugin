<script setup lang="ts">
import { computed, ref } from 'vue';
import { t } from '../../i18n';
import ConfigCard from '../components/ConfigCard.vue';
import ConfigCheckbox from '../components/ConfigCheckbox.vue';
import ConfigMultiPicker from '../components/ConfigMultiPicker.vue';
import ConfigNumber from '../components/ConfigNumber.vue';
import ConfigSelect, { type SelectOption } from '../components/ConfigSelect.vue';
import { useConfigStore } from '../libs/store';
import { namedOptions, valueOptions } from '../libs/options';

const store = useConfigStore();
const selectedUserId = ref('');
const expandedProfileId = ref<string | null>(null);
const userOptions = computed<SelectOption[]>(() => [
  { value: '', label: t('users.selectUser') },
  ...namedOptions(store.users.value
    .filter((user) => !store.config.UserProfiles.some((profile) => profile.UserId === user.Id)))
]);
const genreOptions = () => valueOptions(store.genres.value);
const userName = (userId: string) => store.users.value.find((user) => user.Id === userId)?.Name ?? t('users.unknownUser');

function addProfile(): void {
  if (!selectedUserId.value) return;
  store.addUserProfile(selectedUserId.value);
  expandedProfileId.value = store.config.UserProfiles[store.config.UserProfiles.length - 1]?.Id ?? null;
  selectedUserId.value = '';
}
</script>

<template>
  <section id="featuredPanel-users" class="jmp-section jmp-section-plain" role="tabpanel" aria-labelledby="featuredTab-users">
    <div class="ec-userSettingsGrid">
      <ConfigCard :title="t('users.dismissalsTitle')" :help="t('users.dismissalsHelp')">
        <ConfigCheckbox v-model="store.config.DismissalPolicy.Enabled" :label="t('users.dismissalsEnabled')" />
        <div class="ec-policyGrid" :class="{ 'ec-disabledGroup': !store.config.DismissalPolicy.Enabled }">
          <ConfigCheckbox v-model="store.config.DismissalPolicy.AllowTitle" :label="t('users.dismissTitle')" :disabled="!store.config.DismissalPolicy.Enabled" />
          <ConfigCheckbox v-model="store.config.DismissalPolicy.AllowSeries" :label="t('users.dismissSeries')" :disabled="!store.config.DismissalPolicy.Enabled" />
          <ConfigCheckbox v-model="store.config.DismissalPolicy.AllowFranchise" :label="t('users.dismissFranchise')" :disabled="!store.config.DismissalPolicy.Enabled" />
        </div>
      </ConfigCard>

      <ConfigCard :title="t('users.personalizationTitle')" :help="t('users.personalizationHelp')">
        <ConfigCheckbox v-model="store.config.PersonalizationPolicy.Enabled" :label="t('users.personalizationEnabled')" />
        <div class="ec-policyGrid" :class="{ 'ec-disabledGroup': !store.config.PersonalizationPolicy.Enabled }">
          <ConfigCheckbox v-model="store.config.PersonalizationPolicy.AllowSourceSelection" :label="t('users.allowSources')" :disabled="!store.config.PersonalizationPolicy.Enabled" />
          <ConfigCheckbox v-model="store.config.PersonalizationPolicy.AllowSourceWeights" :label="t('users.allowWeights')" :disabled="!store.config.PersonalizationPolicy.Enabled" />
          <ConfigCheckbox v-model="store.config.PersonalizationPolicy.AllowPreferredGenres" :label="t('users.allowGenres')" :disabled="!store.config.PersonalizationPolicy.Enabled" />
          <ConfigCheckbox v-model="store.config.PersonalizationPolicy.AllowUnplayedBoost" :label="t('users.allowUnplayed')" :disabled="!store.config.PersonalizationPolicy.Enabled" />
          <ConfigCheckbox v-model="store.config.PersonalizationPolicy.AllowFavouriteBoost" :label="t('users.allowFavourites')" :disabled="!store.config.PersonalizationPolicy.Enabled" />
          <ConfigCheckbox v-model="store.config.PersonalizationPolicy.AllowInProgressSeriesBoost" :label="t('users.allowInProgress')" :disabled="!store.config.PersonalizationPolicy.Enabled" />
          <ConfigCheckbox v-model="store.config.PersonalizationPolicy.AllowRepeatCooldown" :label="t('users.allowCooldown')" :disabled="!store.config.PersonalizationPolicy.Enabled" />
        </div>
      </ConfigCard>

      <ConfigCard :title="t('users.defaultsTitle')" :help="t('users.defaultsHelp')">
        <ConfigMultiPicker v-model="store.config.PersonalizationDefaults.PreferredGenres" :label="t('users.preferredGenres')" :options="genreOptions()" />
        <div class="ec-scoreGrid">
          <ConfigNumber v-model="store.config.PersonalizationDefaults.UnplayedBoost" :label="t('users.unplayedBoost')" :min="0" :max="100" :step="1" />
          <ConfigNumber v-model="store.config.PersonalizationDefaults.FavouriteBoost" :label="t('users.favouriteBoost')" :min="0" :max="100" :step="1" />
          <ConfigNumber v-model="store.config.PersonalizationDefaults.PreferredGenreBoost" :label="t('users.genreBoost')" :min="0" :max="100" :step="1" />
          <ConfigNumber v-model="store.config.PersonalizationDefaults.InProgressSeriesBoost" :label="t('users.inProgressBoost')" :min="0" :max="100" :step="1" />
        </div>
      </ConfigCard>
    </div>

    <ConfigCard :title="t('users.title')" :help="t('users.help')">
      <div class="ec-userExplanation">
        <strong>{{ t('users.howItWorks') }}</strong>
        <ol>
          <li>{{ t('users.stepEligibility') }}</li>
          <li>{{ t('users.stepScoring') }}</li>
          <li>{{ t('users.stepPriority') }}</li>
        </ol>
      </div>
      <div class="ec-addSourceRow">
        <ConfigSelect v-model="selectedUserId" :label="t('users.newProfile')" :options="userOptions" />
        <button type="button" class="raised button-submit emby-button ec-addSourceButton" :disabled="!selectedUserId" @click="addProfile">
          <span class="material-icons" aria-hidden="true">person_add</span>{{ t('users.addProfile') }}
        </button>
      </div>
    </ConfigCard>

    <div v-if="store.config.UserProfiles.length" class="ec-userProfiles">
      <article v-for="(profile, index) in store.config.UserProfiles" :key="profile.Id" class="ec-userProfile">
        <header class="ec-userProfileHeader">
          <button type="button" class="ec-userProfileToggle" :aria-expanded="expandedProfileId === profile.Id"
            @click="expandedProfileId = expandedProfileId === profile.Id ? null : profile.Id">
            <span>
              <span class="ec-sourceRuleEyebrow">{{ t('users.profile') }}</span>
              <strong>{{ userName(profile.UserId) }}</strong>
              <small>
                {{ profile.Enabled ? t('source.statusActive') : t('source.statusInactive') }}
                · {{ t('users.summaryUnplayed', { value: profile.UnplayedBoost }) }}
                · {{ t('users.summaryFavorite', { value: profile.FavouriteBoost }) }}
                · {{ t('users.summaryGenre', { value: profile.PreferredGenreBoost }) }}
                · {{ t('users.summarySeries', { value: profile.InProgressSeriesBoost }) }}
              </small>
            </span>
            <span class="material-icons ec-userProfileChevron" aria-hidden="true">expand_more</span>
          </button>
          <div class="ec-userProfileActions">
            <button type="button" class="paper-icon-button-light ec-ruleIconButton ec-removeRule" :title="t('users.removeProfile')" @click="store.removeUserProfile(index)"><span class="material-icons" aria-hidden="true">delete</span></button>
          </div>
        </header>
        <div v-show="expandedProfileId === profile.Id" class="ec-userProfileBody">
        <ConfigCheckbox v-model="profile.Enabled" :label="t('users.enabled')" />
        <p class="jmp-subsectionHelp">{{ t('users.scoringHelp') }}</p>
        <ConfigMultiPicker v-model="profile.PreferredGenres" :label="t('users.preferredGenres')" :options="genreOptions()" />
        <div class="ec-scoreGrid">
          <ConfigNumber v-model="profile.UnplayedBoost" :label="t('users.unplayedBoost')" :min="0" :max="100" :step="1" />
          <ConfigNumber v-model="profile.FavouriteBoost" :label="t('users.favouriteBoost')" :min="0" :max="100" :step="1" />
          <ConfigNumber v-model="profile.PreferredGenreBoost" :label="t('users.genreBoost')" :min="0" :max="100" :step="1" />
          <ConfigNumber v-model="profile.InProgressSeriesBoost" :label="t('users.inProgressBoost')" :min="0" :max="100" :step="1" />
        </div>
        </div>
      </article>
    </div>
    <div v-else class="ec-emptySources"><span class="material-icons" aria-hidden="true">group</span><h3>{{ t('users.emptyTitle') }}</h3><p>{{ t('users.emptyHelp') }}</p></div>
  </section>
</template>

<style scoped>
.ec-addSourceRow { align-items: end; display: grid; gap: 1rem; grid-template-columns: minmax(15rem, 1fr) auto; }
.ec-addSourceRow > :deep(.selectContainer) { margin-bottom: 0; }
.ec-userExplanation { background: var(--ec-theme-action-focus); border: 1px solid var(--ec-theme-primary); border-radius: var(--ec-theme-radius); margin-bottom: 1rem; padding: .75rem .85rem; }
.ec-userExplanation strong { display: block; margin-bottom: .35rem; }
.ec-userExplanation ol { display: grid; gap: .25rem; margin: 0; padding-left: 1.25rem; }
.ec-userExplanation li { line-height: 1.35; opacity: .85; }
.ec-userProfiles { display: grid; gap: 1rem; margin-top: 1rem; }
.ec-userProfile { background: var(--ec-config-card-background); border: 1px solid var(--ec-theme-divider); border-radius: .9rem; padding: 1rem; }
.ec-userProfileHeader { align-items: center; display: grid; gap: .35rem; grid-template-columns: minmax(0, 1fr) auto; }
.ec-userProfileToggle { align-items: center; background: transparent; border: 0; color: inherit; cursor: pointer; display: flex; justify-content: space-between; min-width: 0; padding: 0; text-align: left; }
.ec-userProfileToggle > span:first-child { display: grid; gap: .16rem; min-width: 0; }
.ec-userProfileToggle strong { font-size: 1.08rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ec-userProfileToggle small { display: flex; flex-wrap: wrap; font-size: .78rem; gap: .15rem; opacity: .68; }
.ec-userProfileChevron { transition: transform .16s ease; }
.ec-userProfileToggle[aria-expanded="true"] .ec-userProfileChevron { transform: rotate(180deg); }
.ec-userProfileBody { border-top: 1px solid var(--ec-theme-divider); margin-top: .8rem; padding-top: .8rem; }
.ec-sourceRuleEyebrow { font-size: .7rem; letter-spacing: .08em; margin: 0; opacity: .58; text-transform: uppercase; }
.ec-userProfileActions { align-items: center; display: flex; gap: .15rem; }
.ec-userProfileActions > :deep(.checkboxContainer) { margin-bottom: 0; }
.ec-userProfileBody > .jmp-subsectionHelp { margin-bottom: .75rem; }
.ec-scoreGrid { display: grid; gap: .85rem 1rem; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.ec-scoreGrid :deep(.inputContainer) { margin-bottom: 0; }
.ec-policyGrid { display: grid; gap: .25rem 1rem; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.ec-policyGrid :deep(.checkboxContainer) { margin-bottom: .35rem; }
.ec-disabledGroup { opacity: .55; }
.ec-userSettingsGrid { display: grid; gap: 1.5rem; grid-template-columns: repeat(2, minmax(0, 1fr)); margin-bottom: 1rem; }

@media (max-width: 900px) {
  .ec-userSettingsGrid { grid-template-columns: 1fr; }
}

@media (max-width: 600px) {
  .ec-addSourceRow { grid-template-columns: 1fr; }
  .ec-scoreGrid { grid-template-columns: 1fr; }
  .ec-policyGrid { grid-template-columns: 1fr; }
  .ec-userProfileHeader { align-items: center; }
}
</style>
