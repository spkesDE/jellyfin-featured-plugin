export function openItemDetails(itemId: string): void {
  if (window.Emby?.Page?.showItem) {
    window.Emby.Page.showItem(itemId);
    return;
  }

  window.location.hash = `#/details?id=${encodeURIComponent(itemId)}`;
}
