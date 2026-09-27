export interface TrailerPlaybackOptions {
  muted: boolean;
  volume: number;
  startOffsetSeconds: number;
  endOffsetSeconds: number;
  loop: boolean;
  onEnded: () => void;
  onError: (error: Error) => void;
  startFraction?: number;
  maximumDurationSeconds?: number;
  concealDurationMilliseconds?: number;
  onConcealStart?: (durationMilliseconds: number) => void;
  onReveal?: () => void;
}

export interface TrailerPlayer {
  readonly element: HTMLElement;
  play(): Promise<void>;
  pause(): Promise<void>;
  setMuted(muted: boolean): Promise<void>;
  setVolume(volume: number): Promise<void>;
  destroy(): void;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function asError(error: unknown, fallback: string): Error {
  return error instanceof Error ? error : new Error(fallback);
}
