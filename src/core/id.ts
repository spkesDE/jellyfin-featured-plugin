/** Create a collision-resistant identifier with a fallback for legacy webOS browsers. */
export function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
