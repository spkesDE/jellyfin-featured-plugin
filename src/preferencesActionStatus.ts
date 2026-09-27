import { t } from './i18n';

/** Owns the shared busy and error state for every mutation made by the preferences dialog. */
export class PreferencesActionStatus {
  constructor(
    private readonly dialog: HTMLFormElement,
    private readonly status: HTMLElement
  ) {}

  async run(action: () => Promise<unknown>): Promise<boolean> {
    this.setBusy(true);
    this.status.textContent = '';
    try {
      await action();
      return true;
    } catch (error) {
      this.status.textContent = t('preferences.saveFailed', { error: formatError(error) });
      return false;
    } finally {
      this.setBusy(false);
    }
  }

  private setBusy(busy: boolean): void {
    this.dialog.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
      button.disabled = busy;
    });
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
