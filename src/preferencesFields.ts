import { t, type TranslationKey } from './i18n';

export type GenrePreferenceState = 'neutral' | 'preferred' | 'excluded';

function keepFieldKeyboardInputLocal(event: KeyboardEvent): void {
  // Jellyfin registers page-wide keyboard handlers for navigation and playback.
  // Let the browser edit this field, but do not let those shortcuts consume it.
  event.stopPropagation();
}

export function createCheckbox(label: string, checked: boolean, disabled: boolean): HTMLLabelElement {
  const wrapper = document.createElement('label');
  wrapper.className = 'emby-checkbox-label ec-preference-check';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.className = 'emby-checkbox';
  input.checked = checked;
  input.disabled = disabled;
  const text = document.createElement('span');
  text.className = 'checkboxLabel';
  text.textContent = label;
  const outline = document.createElement('span');
  outline.className = 'checkboxOutline';
  outline.innerHTML =
    '<span class="material-icons checkboxIcon checkboxIcon-checked check"></span><span class="material-icons checkboxIcon checkboxIcon-unchecked"></span>';
  wrapper.append(input, text, outline);
  return wrapper;
}

export function createNumberField(label: string, value: number, max: number): HTMLLabelElement {
  const wrapper = document.createElement('label');
  wrapper.className = 'inputContainer ec-preference-number';
  const text = document.createElement('span');
  text.className = 'inputLabel';
  text.textContent = label;
  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'emby-input';
  input.min = '0';
  input.max = String(max);
  input.step = '1';
  input.value = String(value);
  input.addEventListener('keydown', keepFieldKeyboardInputLocal);
  input.addEventListener('keypress', keepFieldKeyboardInputLocal);
  input.addEventListener('keyup', keepFieldKeyboardInputLocal);
  wrapper.append(text, input);
  return wrapper;
}

const COOLDOWN_CHOICES: Array<[number, TranslationKey]> = [
  [0, 'preferences.cooldown.off'],
  [1, 'preferences.cooldown.1h'],
  [6, 'preferences.cooldown.6h'],
  [12, 'preferences.cooldown.12h'],
  [24, 'preferences.cooldown.24h'],
  [72, 'preferences.cooldown.3d'],
  [168, 'preferences.cooldown.7d'],
  [336, 'preferences.cooldown.14d'],
  [720, 'preferences.cooldown.30d']
];

export function createCooldownField(value: number): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'selectContainer ec-preference-cooldown';
  const fieldId = 'ec-preference-cooldown-hours';
  const label = document.createElement('label');
  label.className = 'selectLabel';
  label.htmlFor = fieldId;
  label.textContent = t('preferences.cooldown');
  const select = document.createElement('select');
  select.id = fieldId;
  select.className = 'emby-select emby-select-withcolor';
  select.dataset.cooldownHours = 'true';
  const values = new Set(COOLDOWN_CHOICES.map(([hours]) => hours));
  if (!values.has(value)) select.add(new Option(t('preferences.cooldown.custom', { hours: value }), String(value)));
  for (const [hours, key] of COOLDOWN_CHOICES) select.add(new Option(t(key), String(hours)));
  select.value = String(value);
  const arrow = document.createElement('div');
  arrow.className = 'selectArrowContainer';
  arrow.setAttribute('aria-hidden', 'true');
  arrow.innerHTML = '<span class="selectArrow material-icons keyboard_arrow_down"></span>';
  wrapper.append(label, select, arrow);
  return wrapper;
}

export function createGenreSelector(genre: string, initialState: GenrePreferenceState): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ec-preference-genre';
  button.dataset.genre = genre;
  const marker = document.createElement('span');
  marker.className = 'ec-preference-genre-marker';
  marker.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span');
  label.textContent = genre;
  button.append(marker, label);

  const setState = (state: GenrePreferenceState): void => {
    button.dataset.genreState = state;
    marker.textContent = state === 'preferred' ? '✓' : state === 'excluded' ? '×' : '';
    button.setAttribute('aria-label', `${genre}: ${t(`preferences.genre.${state}`)}`);
  };
  setState(initialState);
  button.addEventListener('click', () => {
    const state = button.dataset.genreState as GenrePreferenceState;
    setState(state === 'neutral' ? 'preferred' : state === 'preferred' ? 'excluded' : 'neutral');
  });
  return button;
}
