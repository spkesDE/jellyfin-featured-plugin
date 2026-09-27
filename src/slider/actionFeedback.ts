const TRANSIENT_ACTION_ERROR_MS = 4000;

export function showTransientActionError(button: HTMLButtonElement, className: string, message: string): void {
  button.dataset.error = message;
  button.title = message;
  const status = document.createElement('span');
  status.className = className;
  status.setAttribute('role', 'alert');
  status.textContent = message;
  button.after(status);
  window.setTimeout(() => status.remove(), TRANSIENT_ACTION_ERROR_MS);
}
