import { USER_PREFERENCES_CHANGED_EVENT } from '../constants';
import { requestJson } from '../core/apiClient';
import { t } from '../i18n';
import type {
  FeaturedDismissalMutationResponse,
  FeaturedDismissalOption,
  FeaturedDismissalScope,
  FeaturedItem
} from '../types/featured';

let activeToast: HTMLElement | null = null;
let toastTimer: number | null = null;

function notifyFeedChanged(): void {
  document.dispatchEvent(new CustomEvent(USER_PREFERENCES_CHANGED_EVENT));
}

function optionLabel(option: FeaturedDismissalOption): string {
  if (option.scope === 'series') return t('carousel.dismissSeries');
  if (option.scope === 'franchise') return t('carousel.dismissFranchise', { name: option.name });
  return t('carousel.dismissTitle');
}

function removeToast(): void {
  if (toastTimer !== null) window.clearTimeout(toastTimer);
  toastTimer = null;
  activeToast?.remove();
  activeToast = null;
}

function toastContainer(): HTMLElement {
  const existing = document.querySelector<HTMLElement>('.toastContainer');
  if (existing) return existing;
  const container = document.createElement('div');
  container.className = 'toastContainer';
  document.body.appendChild(container);
  return container;
}

function createToast(role: 'alert' | 'status'): HTMLElement {
  removeToast();
  const toast = document.createElement('div');
  toast.className = 'toast toastVisible';
  toast.setAttribute('role', role);
  toastContainer().appendChild(toast);
  activeToast = toast;
  return toast;
}

function showMessage(message: string): void {
  const toast = createToast('alert');
  toast.textContent = message;
  toastTimer = window.setTimeout(removeToast, 6000);
}

function showUndo(item: FeaturedItem, dismissalId: string): void {
  const toast = createToast('status');
  const message = document.createElement('span');
  message.textContent = t('carousel.dismissed', { name: item.name });
  const undo = document.createElement('button');
  undo.type = 'button';
  undo.className = 'button-link emby-button';
  undo.textContent = t('carousel.undo');
  undo.addEventListener('click', async () => {
    undo.disabled = true;
    try {
      await requestJson('featured/dismissals/undo', {
        method: 'POST',
        body: { dismissalId }
      });
      removeToast();
      notifyFeedChanged();
    } catch {
      showMessage(t('carousel.undoFailed'));
    }
  });
  toast.append(message, undo);
  toastTimer = window.setTimeout(removeToast, 10_000);
}

async function dismiss(item: FeaturedItem, scope: FeaturedDismissalScope, control: HTMLButtonElement): Promise<void> {
  control.disabled = true;
  try {
    const result = await requestJson<FeaturedDismissalMutationResponse>('featured/dismissals', {
      method: 'POST',
      body: { itemId: item.id, scope }
    });
    showUndo(item, result.dismissal.id);
    notifyFeedChanged();
  } catch {
    control.disabled = false;
    showMessage(t('carousel.dismissFailed'));
  }
}

function showScopePicker(item: FeaturedItem, options: FeaturedDismissalOption[], control: HTMLButtonElement): void {
  const dialog = document.createElement('dialog');
  dialog.className = 'actionSheet actionsheet-not-fullscreen';
  dialog.setAttribute('aria-label', t('carousel.dismiss'));

  const content = document.createElement('div');
  content.className = 'actionSheetContent';
  const title = document.createElement('h1');
  title.className = 'actionSheetTitle';
  title.textContent = t('carousel.dismiss');
  const list = document.createElement('div');
  list.className = 'actionSheetScroller scrollY';

  const close = (): void => {
    if (dialog.open) dialog.close();
    else dialog.remove();
  };
  for (const option of options) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'listItem listItem-button actionSheetMenuItem emby-button';
    const icon = document.createElement('span');
    icon.className = 'actionsheetMenuItemIcon listItemIcon listItemIcon-transparent material-icons visibility_off';
    icon.setAttribute('aria-hidden', 'true');
    const body = document.createElement('span');
    body.className = 'listItemBody actionsheetListItemBody';
    const optionText = document.createElement('span');
    optionText.className = 'listItemBodyText actionSheetItemText';
    optionText.textContent = optionLabel(option);
    body.appendChild(optionText);
    button.append(icon, body);
    button.addEventListener('click', () => {
      close();
      void dismiss(item, option.scope, control);
    });
    list.appendChild(button);
  }
  content.append(title, list);
  dialog.appendChild(content);
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });
  document.body.appendChild(dialog);
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

export function createDismissalControl(item: FeaturedItem, variant: 'action' | 'metadata' = 'action'): HTMLButtonElement {
  const options = item.dismissalOptions ?? [];
  const button = document.createElement('button');
  button.type = 'button';
  const label = t('carousel.dismiss');
  button.setAttribute('aria-label', label);
  button.title = label;

  if (variant === 'metadata') {
    button.className = 'button-flat detailButton emby-button ec-dismissal-button ec-dismissal-button-meta';
  } else {
    button.className = 'ec-button ec-button-secondary ec-dismissal-button raised emby-button';
  }
  const content = document.createElement('span');
  content.className = 'detailButton-content';
  const icon = document.createElement('span');
  icon.className = 'material-icons detailButton-icon visibility_off';
  icon.setAttribute('aria-hidden', 'true');
  content.appendChild(icon);
  button.appendChild(content);

  button.addEventListener('click', () => {
    if (button.disabled || options.length === 0) return;
    if (options.length === 1) void dismiss(item, options[0].scope, button);
    else showScopePicker(item, options, button);
  });
  return button;
}
