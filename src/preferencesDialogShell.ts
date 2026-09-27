import { replaceElementChildren } from './core/dom';
import { t } from './i18n';

const TEMPORARY_ERROR_DISPLAY_MS = 3500;

function createIconButton(iconName: string, label: string, className: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.setAttribute('aria-label', label);
  const icon = document.createElement('span');
  icon.className = `material-icons ${iconName}`;
  icon.setAttribute('aria-hidden', 'true');
  button.appendChild(icon);
  return button;
}

export function createPreferencesHeader(): HTMLElement {
  const header = document.createElement('header');
  header.className = 'ec-preferences-header';
  const title = document.createElement('h2');
  title.id = 'ec-preferences-title';
  title.textContent = t('preferences.title');
  header.append(
    title,
    createIconButton('close', t('preferences.close'), 'paper-icon-button-light ec-preferences-close')
  );
  return header;
}

export function createPreferencesHotkeys(): HTMLElement {
  const hotkeys = document.createElement('aside');
  hotkeys.className = 'ec-preferences-hotkeys';
  const title = document.createElement('strong');
  title.textContent = t('preferences.hotkeys');
  hotkeys.append(title);
  for (const [key, label] of [
    ['M', t('preferences.hotkeyMute')],
    ['+ / −', t('preferences.hotkeyVolume')],
    [t('preferences.hotkeySpace'), t('preferences.hotkeyPause')]
  ]) {
    const row = document.createElement('span');
    const keyElement = document.createElement('kbd');
    keyElement.textContent = key;
    row.append(keyElement, ` ${label}`);
    hotkeys.appendChild(row);
  }
  return hotkeys;
}

export function createPreferencesActions(showButtons: boolean): {
  root: HTMLDivElement;
  status: HTMLSpanElement;
} {
  const root = document.createElement('div');
  root.className = 'ec-preferences-actions';
  const status = document.createElement('span');
  status.className = 'ec-preferences-status';
  status.setAttribute('aria-live', 'polite');
  root.appendChild(status);
  if (showButtons) {
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'raised emby-button ec-preferences-reset';
    reset.textContent = t('preferences.reset');
    const save = document.createElement('button');
    save.type = 'submit';
    save.className = 'raised button-submit emby-button ec-preferences-save';
    save.textContent = t('preferences.save');
    root.append(reset, save);
  }
  return { root, status };
}

/** Owns modal dismissal and focus restoration while asynchronous content is loading. */
export class PreferencesDialogShell {
  readonly backdrop: HTMLDivElement;
  readonly loading: HTMLDivElement;
  private readonly previouslyFocused: HTMLElement | null;

  constructor() {
    this.previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'ec-preferences-backdrop';

    const dialog = document.createElement('section');
    dialog.className = 'ec-preferences-dialog ec-preferences-loading-shell';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'ec-preferences-title');
    this.loading = document.createElement('div');
    this.loading.className = 'ec-preferences-loading';
    this.loading.setAttribute('role', 'status');
    const spinner = document.createElement('span');
    spinner.className = 'ec-preferences-spinner';
    spinner.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.textContent = t('preferences.loading');
    this.loading.append(spinner, label);
    dialog.append(createPreferencesHeader(), this.loading);
    this.backdrop.appendChild(dialog);

    this.bindCloseButton();
    this.backdrop.addEventListener('click', (event) => {
      if (event.target === this.backdrop) this.close();
    });
    this.backdrop.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.close();
    });
  }

  get isConnected(): boolean {
    return this.backdrop.isConnected;
  }

  attach(): void {
    document.body.appendChild(this.backdrop);
  }

  replaceContent(dialog: HTMLElement): void {
    replaceElementChildren(this.backdrop, dialog);
    this.bindCloseButton();
  }

  showTemporaryError(error: unknown): void {
    this.loading.setAttribute('role', 'alert');
    replaceElementChildren(
      this.loading,
      document.createTextNode(error instanceof Error ? error.message : String(error))
    );
    window.setTimeout(() => this.close(), TEMPORARY_ERROR_DISPLAY_MS);
  }

  close = (): void => {
    this.backdrop.remove();
    this.previouslyFocused?.focus();
  };

  private bindCloseButton(): void {
    this.backdrop.querySelector('.ec-preferences-close')?.addEventListener('click', this.close);
  }
}
