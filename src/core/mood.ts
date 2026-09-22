import type { Mood } from './types';

/** Remaining-percent boundaries, descending. See docs/SPEC.md §5.2. */
export const DEFAULT_MOOD_THRESHOLDS = [90, 65, 40, 20, 5] as const;

const MOOD_ORDER: Mood[] = ['ecstatic', 'happy', 'neutral', 'worried', 'panic', 'exhausted'];

export const MOOD_EMOJI: Record<Mood, string> = {
  ecstatic: '🤩',
  happy: '🙂',
  neutral: '😐',
  worried: '😟',
  panic: '😰',
  exhausted: '💀'
};

export const MOOD_LABEL_KO: Record<Mood, string> = {
  ecstatic: '아주 좋음',
  happy: '좋음',
  neutral: '보통',
  worried: '불안',
  panic: '위험',
  exhausted: '탈진'
};

/**
 * Maps a remaining percentage to a mood.
 *
 * Thresholds are inclusive lower bounds in descending order: a remaining value
 * of exactly 90 with the default thresholds is `ecstatic`, 89 is `happy`.
 */
export function moodFor(remainingPercent: number, thresholds?: readonly number[]): Mood {
  const bounds = normaliseThresholds(thresholds);
  const value = clampPercent(remainingPercent);
  for (let i = 0; i < bounds.length; i++) {
    if (value >= bounds[i]) {
      return MOOD_ORDER[i];
    }
  }
  return MOOD_ORDER[MOOD_ORDER.length - 1];
}

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, value));
}

/**
 * User-supplied thresholds can be any length or out of order. Fall back to the
 * defaults rather than rendering a nonsensical mood.
 */
function normaliseThresholds(thresholds?: readonly number[]): readonly number[] {
  if (!thresholds || thresholds.length !== DEFAULT_MOOD_THRESHOLDS.length) {
    return DEFAULT_MOOD_THRESHOLDS;
  }
  const valid = thresholds.every(
    (n, i) => Number.isFinite(n) && (i === 0 || n < thresholds[i - 1])
  );
  return valid ? thresholds : DEFAULT_MOOD_THRESHOLDS;
}
