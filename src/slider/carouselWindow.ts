interface IdentifiedItem {
  id: string;
}

/** Pure bookkeeping for carousel navigation, rendered windows, and batch de-duplication. */
export class CarouselWindowModel {
  index = 0;
  windowStart = 0;
  discardedItemCount = 0;
  private hasMoreItems: boolean;
  private pendingIndex: number | null = null;
  private hasLeftInitialSlide = false;
  private readonly seenItemIds: Set<string>;

  constructor(initialItemIds: Iterable<string>, hasMore: boolean) {
    this.seenItemIds = new Set(initialItemIds);
    this.hasMoreItems = hasMore;
  }

  get hasMore(): boolean {
    return this.hasMoreItems;
  }

  activate(nextIndex: number, itemCount: number, renderedSlideCount: number, infiniteLoading: boolean): boolean {
    if (infiniteLoading) {
      nextIndex = Math.max(0, nextIndex);
      if (nextIndex >= itemCount) {
        if (this.hasMoreItems) this.pendingIndex = nextIndex;
        return false;
      }
      this.index = nextIndex;
      this.hasLeftInitialSlide ||= this.index > 0 || this.discardedItemCount > 0;
      return true;
    }

    this.index = (nextIndex + renderedSlideCount) % renderedSlideCount;
    return true;
  }

  shouldPrefetch(batchSize: number, itemCount: number): boolean {
    if (!this.hasMoreItems || !this.hasLeftInitialSlide) return false;
    return itemCount - this.index <= Math.max(1, batchSize);
  }

  isActiveIndexRendered(renderedSlideCount: number): boolean {
    return this.index >= this.windowStart && this.index < this.windowStart + renderedSlideCount;
  }

  calculateWindowStart(itemCount: number, batchSize: number, maximumDomSlides: number): number {
    const maximumStart = Math.max(0, itemCount - maximumDomSlides);
    const desiredStart =
      this.index < this.windowStart
        ? Math.max(0, this.index - Math.max(1, batchSize) + 1)
        : Math.max(0, this.index - maximumDomSlides + Math.max(1, batchSize));
    return Math.min(maximumStart, desiredStart);
  }

  setRenderedWindowStart(start: number): void {
    this.windowStart = start;
  }

  acceptBatch<T extends IdentifiedItem>(items: readonly T[], responseHasMore: boolean, maximumSeenIds: number): T[] {
    const accepted = items.filter((item) => {
      if (this.seenItemIds.has(item.id)) return false;
      this.seenItemIds.add(item.id);
      return true;
    });
    this.hasMoreItems = responseHasMore && accepted.length > 0;
    while (this.seenItemIds.size > maximumSeenIds) {
      const oldestId = this.seenItemIds.values().next().value;
      if (!oldestId) break;
      this.seenItemIds.delete(oldestId);
    }
    return accepted;
  }

  getExcludedItemIds(): string[] {
    return [...this.seenItemIds];
  }

  takePendingIndex(): number | null {
    const value = this.pendingIndex;
    this.pendingIndex = null;
    return value;
  }

  trimDiscardedPrefix(itemCount: number, maximumCachedItems: number): number {
    const removeCount = itemCount - maximumCachedItems;
    if (removeCount <= 0 || this.index < removeCount || this.windowStart < removeCount) return 0;
    this.index -= removeCount;
    this.windowStart -= removeCount;
    this.discardedItemCount += removeCount;
    if (this.pendingIndex !== null) this.pendingIndex = Math.max(0, this.pendingIndex - removeCount);
    return removeCount;
  }
}
