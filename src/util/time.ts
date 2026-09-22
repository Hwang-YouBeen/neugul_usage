/**
 * Accepts the two shapes both CLIs have been observed to emit for reset times:
 * Unix epoch seconds (number) and ISO 8601 (string). Returns epoch ms.
 */
export function toEpochMs(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Values below ~1e12 are seconds; above that they are already milliseconds.
    return value < 1e12 ? Math.round(value * 1000) : Math.round(value);
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

/** "1시간 12분", "2일 4시간", "곧" */
export function formatCountdown(targetMs: number | undefined, now = Date.now()): string {
  if (targetMs === undefined) {
    return '알 수 없음';
  }
  const diff = targetMs - now;
  if (diff <= 0) {
    return '곧';
  }
  const minutes = Math.floor(diff / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;

  if (days > 0) {
    return hours > 0 ? `${days}일 ${hours}시간` : `${days}일`;
  }
  if (hours > 0) {
    return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
  }
  return `${Math.max(1, mins)}분`;
}

/** "12초 전", "3분 전" */
export function formatAgo(timestampMs: number | undefined, now = Date.now()): string {
  if (timestampMs === undefined) {
    return '기록 없음';
  }
  const seconds = Math.max(0, Math.floor((now - timestampMs) / 1000));
  if (seconds < 60) {
    return `${seconds}초 전`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}분 전`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}시간 전`;
  }
  return `${Math.floor(hours / 24)}일 전`;
}
