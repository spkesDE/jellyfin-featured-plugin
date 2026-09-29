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
  ...namedOptions(
    store.users.value.filter((user) => !store.config.UserProfiles.some((profile) => profile.UserId === user.Id))
  )
]);
const genreOptions = () => valueOptions(store.genres.value);
const userName = (userId: string) =>
  store.users.value.find((user) => user.Id === userId)?.Name ?? t('users.unknownUser');

function addProfile(): void {
  if (!selectedUserId.value) return;
  store.addUserProfile(selectedUserId.value);
  expandedProfileId.value = store.config.UserProfiles[store.config.UserProfiles.length - 1]?.Id ?? null;
  selectedUserId.value = '';
}
</script>

<template>
  <section
    id="featuredPanel-users"
    class="jmp-section jmp-section-plain"
    role="tabpanel"
    aria-labelledby="featuredTab-users"
  >
    <div class="featured-userSettingsGrid">
      <ConfigCard :title="t('users.dismissalsTitle')" :help="t('users.dismissalsHelp')">
        <ConfigCheckbox v-model="store.config.DismissalPolicy.Enabled" :label="t('users.dismissalsEnabled')" />
        <div class="featured-policyGrid" :class="{ 'featured-disabledGroup': !store.config.DismissalPolicy.Enabled }">
          <ConfigCheckbox
            v-model="store.config.DismissalPolicy.AllowTitle"
            :label="t('users.dismissTitle')"
            :disabled="!store.config.DismissalPolicy.Enabled"
          />
          <ConfigCheckbox
            v-model="store.config.DismissalPolicy.AllowSeries"
            :label="t('users.dismissSeries')"
            :disabled="!store.config.DismissalPolicy.Enabled"
          />
          <ConfigCheckbox
            v-model="store.config.DismissalPolicy.AllowFranchise"
            :label="t('users.dismissFranchise')"
            :disabled="!store.config.DismissalPolicy.Enabled"
          />
        </div>
      </ConfigCard>

      <ConfigCard :title="t('users.personalizationTitle')" :help="t('users.personalizationHelp')">
        <ConfigCheckbox
          v-model="store.config.PersonalizationPolicy.Enabled"
          :label="t('users.personalizationEnabled')"
        />
        <div
          class="featured-policyGrid"
          :class="{ 'featured-disabledGroup': !store.config.PersonalizationPolicy.Enabled }"
        >
          <ConfigCheckbox
            v-model="store.config.PersonalizationPolicy.AllowSourceSelection"
            :label="t('users.allowSources')"
            :disabled="!store.config.PersonalizationPolicy.Enabled"
          />
          <ConfigCheckbox
            v-model="store.config.PersonalizationPolicy.AllowSourceWeights"
            :label="t('users.allowWeights')"
            :disabled="!store.config.PersonalizationPolicy.Enabled"
          />
          <ConfigCheckbox
            v-model="store.config.PersonalizationPolicy.AllowPreferredGenres"
            :label="t('users.allowGenres')"
            :disabled="!store.config.PersonalizationPolicy.Enabled"
          />
          <ConfigCheckbox
            v-model="store.config.PersonalizationPolicy.AllowUnplayedBoost"
            :label="t('users.allowUnplayed')"
            :disabled="!store.config.PersonalizationPolicy.Enabled"
          />
          <ConfigCheckbox
            v-model="store.config.PersonalizationPolicy.AllowFavouriteBoost"
            :label="t('users.allowFavourites')"
            :disabled="!store.config.PersonalizationPolicy.Enabled"
          />
          <ConfigCheckbox
            v-model="store.config.PersonalizationPolicy.AllowInProgressSeriesBoost"
            :label="t('users.allowInProgress')"
            :disabled="!store.config.PersonalizationPolicy.Enabled"
          />
          <ConfigCheckbox
            v-model="store.config.PersonalizationPolicy.AllowRepeatCooldown"
            :label="t('users.allowCooldown')"
            :disabled="!store.config.PersonalizationPolicy.Enabled"
          />
        </div>
      </ConfigCard>

      <ConfigCard :title="t('users.defaultsTitle')" :help="t('users.defaultsHelp')">
        <ConfigMultiPicker
          v-model="store.config.PersonalizationDefaults.PreferredGenres"
          :label="t('users.preferredGenres')"
          :options="genreOptions()"
        />
        <div class="featured-scoreGrid">
          <ConfigNumber
            v-model="store.config.PersonalizationDefaults.UnplayedBoost"
            :label="t('users.unplayedBoost')"
            :min="0"
            :max="100"
            :step="1"
          />
          <ConfigNumber
            v-model="store.config.PersonalizationDefaults.FavouriteBoost"
            :label="t('users.favouriteBoost')"
            :min="0"
            :max="100"
            :step="1"
          />
          <ConfigNumber
            v-model="store.config.PersonalizationDefaults.PreferredGenreBoost"
            :label="t('users.genreBoost')"
            :min="0"
            :max="100"
            :step="1"
          />
          <ConfigNumber
            v-model="store.config.PersonalizationDefaults.InProgressSeriesBoost"
            :label="t('users.inProgressBoost')"
            :min="0"
            :max="100"
            :step="1"
          />
        </div>
      </ConfigCard>
    </div>

    <ConfigCard :title="t('users.title')" :help="t('users.help')">
      <div class="featured-userExplanation">
        <strong>{{ t('users.howItWorks') }}</strong>
        <ol>
          <li>{{ t('users.stepEligibility') }}</li>
          <li>{{ t('users.stepScoring') }}</li>
          <li>{{ t('users.stepPriority') }}</li>
        </ol>
      </div>
      <div class="featured-addSourceRow featured-configAddRow">
        <ConfigSelect v-model="selectedUserId" :label="t('users.newProfile')" :options="userOptions" />
        <button
          type="button"
          class="raised button-submit emby-button featured-addSourceButton"
          :disabled="!selectedUserId"
          @click="addProfile"
        >
          <span class="material-icons" aria-hidden="true">person_add</span>{{ t('users.addProfile') }}
        </button>
      </div>
    </ConfigCard>

    <div v-if="store.config.UserProfiles.length" class="featured-userProfiles featured-configStack">
      <article
        v-for="(profile, index) in store.config.UserProfiles"
        :key="profile.Id"
        class="featured-userProfile featured-configCard featured-configCardPadded"
      >
        <header class="featured-userProfileHeader featured-configCardHeader">
          <button
            type="button"
            class="featured-userProfileToggle featured-configCardToggle"
            :aria-expanded="expandedProfileId === profile.Id"
            @click="expandedProfileId = expandedProfileId === profile.Id ? null : profile.Id"
          >
            <span>
              <span class="featured-sourceRuleEyebrow featured-configEyebrow">{{ t('users.profile') }}</span>
              <strong>{{ userName(profile.UserId) }}</strong>
              <small>
                {{ profile.Enabled ? t('source.statusActive') : t('source.statusInactive') }}
                · {{ t('users.summaryUnplayed', { value: profile.UnplayedBoost }) }} ·
                {{ t('users.summaryFavorite', { value: profile.FavouriteBoost }) }} ·
                {{ t('users.summaryGenre', { value: profile.PreferredGenreBoost }) }} ·
                {{ t('users.summarySeries', { value: profile.InProgressSeriesBoost }) }}
              </small>
            </span>
            <span class="material-icons featured-userProfileChevron featured-configChevron" aria-hidden="true"
              >expand_more</span
            >
          </button>
          <div class="featured-userProfileActions featured-configActions">
            <button
              type="button"
              class="paper-icon-button-light featured-ruleIconButton featured-removeRule"
              :title="t('users.removeProfile')"
              @click="store.removeUserProfile(index)"
            >
              <span class="material-icons" aria-hidden="true">delete</span>
            </button>
          </div>
        </header>
        <div v-show="expandedProfileId === profile.Id" class="featured-userProfileBody featured-configCardBody">
          <ConfigCheckbox v-model="profile.Enabled" :label="t('users.enabled')" />
          <p class="jmp-subsectionHelp">{{ t('users.scoringHelp') }}</p>
          <ConfigMultiPicker
            v-model="profile.PreferredGenres"
            :label="t('users.preferredGenres')"
            :options="genreOptions()"
          />
          <div class="featured-scoreGrid jmp-compactGrid">
            <ConfigNumber
              v-model="profile.UnplayedBoost"
              :label="t('users.unplayedBoost')"
              :min="0"
              :max="100"
              :step="1"
            />
            <ConfigNumber
              v-model="profile.FavouriteBoost"
              :label="t('users.favouriteBoost')"
              :min="0"
              :max="100"
              :step="1"
            />
            <ConfigNumber
              v-model="profile.PreferredGenreBoost"
              :label="t('users.genreBoost')"
              :min="0"
              :max="100"
              :step="1"
            />
            <ConfigNumber
              v-model="profile.InProgressSeriesBoost"
              :label="t('users.inProgressBoost')"
              :min="0"
              :max="100"
              :step="1"
            />
          </div>
        </div>
      </article>
    </div>
    <div v-else class="featured-emptySources">
      <span class="material-icons" aria-hidden="true">group</span>
      <h3>{{ t('users.emptyTitle') }}</h3>
      <p>{{ t('users.emptyHelp') }}</p>
    </div>
  </section>
</template>

<style scoped>
.featured-userExplanation {
  background: var(--featured-theme-action-focus);
  border: 1px solid var(--featured-theme-primary);
  border-radius: var(--featured-theme-radius);
  margin-bottom: 1rem;
  padding: 0.75rem 0.85rem;
}
.featured-userExplanation strong {
  display: block;
  margin-bottom: 0.35rem;
}
.featured-userExplanation ol {
  display: grid;
  gap: 0.25rem;
  margin: 0;
  padding-left: 1.25rem;
}
.featured-userExplanation li {
  line-height: 1.35;
  opacity: 0.85;
}
.featured-userProfileToggle > span:first-child {
  gap: 0.16rem;
}
.featured-userProfileToggle strong {
  font-size: 1.08rem;
}
.featured-userProfileToggle small {
  display: flex;
  flex-wrap: wrap;
  font-size: 0.78rem;
  gap: 0.15rem;
  opacity: 0.68;
}
.featured-userProfileToggle[aria-expanded='true'] .featured-userProfileChevron {
  transform: rotate(180deg);
}
.featured-userProfileActions > :deep(.checkboxContainer) {
  margin-bottom: 0;
}
.featured-userProfileBody > .jmp-subsectionHelp {
  margin-bottom: 0.75rem;
}
.featured-scoreGrid :deep(.inputContainer) {
  margin-bottom: 0;
}
.featured-policyGrid {
  display: grid;
  gap: 0.25rem 1rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.featured-policyGrid :deep(.checkboxContainer) {
  margin-bottom: 0.35rem;
}
.featured-disabledGroup {
  opacity: 0.55;
}
.featured-userSettingsGrid {
  display: grid;
  gap: 1.5rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-bottom: 1rem;
}

@media (max-width: 900px) {
  .featured-userSettingsGrid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .featured-policyGrid {
    grid-template-columns: 1fr;
  }
}
</style>
