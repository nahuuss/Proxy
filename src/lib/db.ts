import Datastore from '@seald-io/nedb';

import {
  ensureCompactionState,
  forceMemoryReset as forceMemoryResetInternal,
  getCurrentCompactionIntervalMs as getCurrentCompactionIntervalMsInternal,
  getLastCompactionTime as getLastCompactionTimeInternal,
  scheduleNextCompaction as scheduleNextCompactionInternal
} from './db-compaction';
import { ensureDbStorage, resolveDbFilePath } from './db-files';
import { loadWithRetry } from './db-loader';
import { isBuildPhase, isProtectedDbPhase, isTestPhase } from './db-runtime-phase';

ensureDbStorage();

declare global {
  var connectorsDb: Datastore<unknown> | undefined;
  var metricsDb: Datastore<unknown> | undefined;
  var settingsDb: Datastore<unknown> | undefined;
}

export { isBuildPhase, isTestPhase };

export const connectorsDb = global.connectorsDb || new Datastore({
  filename: resolveDbFilePath('connectors.db'),
  autoload: false
});
void loadWithRetry(connectorsDb, 'connectors.db');

export const metricsDb = global.metricsDb || new Datastore({
  filename: resolveDbFilePath('metrics.db'),
  autoload: false
});
void loadWithRetry(metricsDb, 'metrics.db');

export const settingsDb = global.settingsDb || new Datastore({
  filename: resolveDbFilePath('settings.db'),
  autoload: false
});
void loadWithRetry(settingsDb, 'settings.db');

export const DEFAULT_COMPACT_INTERVAL_MS =
  parseInt(process.env.MEMORY_RESET_INTERVAL_MINUTES || '30') * 60 * 1000;

const compactionInput = {
  connectorsDb,
  metricsDb,
  settingsDb,
  defaultIntervalMs: DEFAULT_COMPACT_INTERVAL_MS
};

ensureCompactionState(DEFAULT_COMPACT_INTERVAL_MS);

export function getLastCompactionTime(): number {
  return getLastCompactionTimeInternal(DEFAULT_COMPACT_INTERVAL_MS);
}

export function getCurrentCompactionIntervalMs(): number {
  return getCurrentCompactionIntervalMsInternal(DEFAULT_COMPACT_INTERVAL_MS);
}

export async function forceMemoryReset(): Promise<void> {
  await forceMemoryResetInternal(compactionInput);
}

export async function scheduleNextCompaction(): Promise<void> {
  await scheduleNextCompactionInternal(compactionInput);
}

export async function rescheduleMemoryResetSchedule(): Promise<void> {
  await scheduleNextCompaction();
}

if (!isProtectedDbPhase()) {
  void scheduleNextCompaction();
}

if (process.env.NODE_ENV !== 'production') {
  global.connectorsDb = connectorsDb;
  global.metricsDb = metricsDb;
  global.settingsDb = settingsDb;
}
