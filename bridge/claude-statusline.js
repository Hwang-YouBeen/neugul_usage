#!/usr/bin/env node
/**
 * Neugul Usage — Claude Code statusline bridge.
 *
 * Claude Code pipes a JSON document to its statusLine command on every update.
 * That document is the only place the live subscription rate limits appear, so
 * this script captures them to a snapshot file the extension watches.
 *
 * Two hard rules, because this runs inside the user's status line:
 *   1. Never exit non-zero and never throw. A broken bridge must not break the
 *      user's status line.
 *   2. If the user already had a statusLine command, run it with the same stdin
 *      and pass its output through unchanged.
 *
 * Dependencies: none. This file is shipped unbundled because Claude Code runs
 * it with whatever Node it finds.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const SNAPSHOT_DIR = path.join(os.homedir(), '.neugul-usage');
const SNAPSHOT_FILE = path.join(SNAPSHOT_DIR, 'claude-usage.json');
const WRAPPED_KEY = 'neugulUsage.wrappedStatusLine';

main();

function main() {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    raw += chunk;
  });
  process.stdin.on('error', () => finish(raw));
  process.stdin.on('end', () => finish(raw));
}

function finish(raw) {
  let input = null;
  try {
    input = JSON.parse(raw);
  } catch {
    input = null;
  }

  if (input) {
    try {
      writeSnapshot(input);
    } catch {
      // Snapshot failures are silent by design.
    }
  }

  passThrough(raw, input);
}

function writeSnapshot(input) {
  const limits = input.rate_limits || {};
  const snapshot = {
    schema: 1,
    capturedAt: Date.now(),
    source: 'statusline',
    cli: 'claude',
    version: typeof input.version === 'string' ? input.version : undefined,
    model: input.model
      ? { id: input.model.id, display_name: input.model.display_name }
      : undefined,
    rateLimits: {
      fiveHour: normaliseWindow(limits.five_hour),
      sevenDay: normaliseWindow(limits.seven_day)
    }
  };

  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  // Atomic replace so the extension never reads a half-written file.
  const tmp = SNAPSHOT_FILE + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(snapshot), 'utf8');
  fs.renameSync(tmp, SNAPSHOT_FILE);
}

/** Either window may be absent; Claude Code drops a window once it has reset. */
function normaliseWindow(win) {
  if (!win || typeof win.used_percentage !== 'number') {
    return undefined;
  }
  return { usedPercent: win.used_percentage, resetsAt: win.resets_at };
}

/**
 * Runs the statusLine command the user had before the bridge was installed.
 * Falls back to a minimal line so the status bar is never empty.
 */
function passThrough(raw, input) {
  const wrapped = readWrappedCommand();
  if (!wrapped) {
    process.stdout.write(defaultLine(input));
    process.exit(0);
    return;
  }

  try {
    const child = spawn(wrapped, {
      shell: true,
      stdio: ['pipe', 'inherit', 'inherit']
    });
    child.on('error', () => {
      process.stdout.write(defaultLine(input));
      process.exit(0);
    });
    child.on('close', () => process.exit(0));
    child.stdin.write(raw);
    child.stdin.end();
  } catch {
    process.stdout.write(defaultLine(input));
    process.exit(0);
  }
}

function readWrappedCommand() {
  try {
    const settingsPath = path.join(
      process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'),
      'settings.json'
    );
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    const wrapped = settings[WRAPPED_KEY];
    if (wrapped && typeof wrapped.command === 'string' && wrapped.command.trim()) {
      return wrapped.command;
    }
  } catch {
    // no wrapped command
  }
  return null;
}

function defaultLine(input) {
  const model = input && input.model && input.model.display_name;
  const five =
    input &&
    input.rate_limits &&
    input.rate_limits.five_hour &&
    typeof input.rate_limits.five_hour.used_percentage === 'number'
      ? Math.round(100 - input.rate_limits.five_hour.used_percentage) + '% left'
      : null;
  return [model, five].filter(Boolean).join(' · ');
}
