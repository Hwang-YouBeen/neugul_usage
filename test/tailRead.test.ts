import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { findLastLine } from '../src/util/tailRead.ts';

async function withTempFile(contents: string, fn: (file: string) => Promise<void>) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'neugul-'));
  const file = path.join(dir, 'sample.jsonl');
  await fs.writeFile(file, contents, 'utf8');
  try {
    await fn(file);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

const isMatch = (line: string) => line.includes('MATCH');

test('finds the last matching line', async () => {
  await withTempFile('MATCH a\nnope\nMATCH b\nnope\n', async (file) => {
    assert.equal(await findLastLine(file, isMatch), 'MATCH b');
  });
});

test('handles a missing trailing newline', async () => {
  await withTempFile('nope\nMATCH last', async (file) => {
    assert.equal(await findLastLine(file, isMatch), 'MATCH last');
  });
});

test('reassembles lines that straddle chunk boundaries', async () => {
  const filler = 'x'.repeat(500);
  const contents = `MATCH ${filler}\n${'nope\n'.repeat(400)}`;
  await withTempFile(contents, async (file) => {
    // A tiny chunk size forces many boundary crossings.
    const found = await findLastLine(file, isMatch, { chunkSize: 16 });
    assert.equal(found, `MATCH ${filler}`);
  });
});

test('preserves multi-byte characters across chunk boundaries', async () => {
  const korean = '사용량'.repeat(40);
  await withTempFile(`MATCH ${korean}\ntail\n`, async (file) => {
    assert.equal(await findLastLine(file, isMatch, { chunkSize: 7 }), `MATCH ${korean}`);
  });
});

test('stops after maxBytes without finding a far-away match', async () => {
  const contents = `MATCH early\n${'nope\n'.repeat(2000)}`;
  await withTempFile(contents, async (file) => {
    assert.equal(await findLastLine(file, isMatch, { maxBytes: 200 }), undefined);
  });
});

test('returns undefined for empty and missing files', async () => {
  await withTempFile('', async (file) => {
    assert.equal(await findLastLine(file, isMatch), undefined);
  });
  assert.equal(await findLastLine(path.join(os.tmpdir(), 'neugul-does-not-exist'), isMatch), undefined);
});
