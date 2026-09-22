import * as fs from 'node:fs/promises';

const NEWLINE = 0x0a;

export interface TailScanOptions {
  /** Bytes read per step. */
  chunkSize?: number;
  /** Stop after scanning this many bytes back from the end. */
  maxBytes?: number;
}

/**
 * Scans a file backwards and returns the last line satisfying `predicate`.
 *
 * Codex rollout files reach tens of megabytes (70MB observed), so the whole
 * file must never be read. We walk back in chunks and stop as soon as we find
 * a match or hit `maxBytes`.
 *
 * Splitting happens at the byte level: 0x0A cannot appear inside a multi-byte
 * UTF-8 sequence, so chunk boundaries never corrupt a decoded line.
 */
export async function findLastLine(
  filePath: string,
  predicate: (line: string) => boolean,
  options: TailScanOptions = {}
): Promise<string | undefined> {
  const chunkSize = options.chunkSize ?? 64 * 1024;
  const maxBytes = options.maxBytes ?? 1024 * 1024;

  let handle: fs.FileHandle | undefined;
  try {
    handle = await fs.open(filePath, 'r');
    const { size } = await handle.stat();
    if (size === 0) {
      return undefined;
    }

    let position = size;
    let carry: Buffer = Buffer.alloc(0);

    while (position > 0) {
      const remaining = maxBytes - (size - position);
      if (remaining <= 0) {
        break;
      }
      // Cap the first (and every) read by maxBytes. Otherwise a file smaller
      // than chunkSize would be scanned in full and ignore the budget.
      const readSize = Math.min(chunkSize, position, remaining);
      position -= readSize;

      const chunk = Buffer.alloc(readSize);
      await handle.read(chunk, 0, readSize, position);
      const buffer = Buffer.concat([chunk, carry]);

      const segments = splitLines(buffer);
      // segments[0] may be a partial line unless we reached the start of the file.
      const firstComplete = position === 0 ? 0 : 1;
      for (let i = segments.length - 1; i >= firstComplete; i--) {
        const line = segments[i].toString('utf8').trim();
        if (line.length > 0 && predicate(line)) {
          return line;
        }
      }
      carry = segments[0] ?? Buffer.alloc(0);
    }

    return undefined;
  } catch {
    return undefined;
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

function splitLines(buffer: Buffer): Buffer[] {
  const out: Buffer[] = [];
  let start = 0;
  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i] === NEWLINE) {
      out.push(buffer.subarray(start, i));
      start = i + 1;
    }
  }
  out.push(buffer.subarray(start));
  return out;
}
