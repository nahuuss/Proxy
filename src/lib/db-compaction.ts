import Datastore from '@seald-io/nedb';

import { isProtectedDbPhase } from './db-runtime-phase';

type SettingsRecord = {
  memoryResetIntervalMinutes?: number | string;
} | null;

export type DbCompactionInput = {
  connectorsDb: Datastore<unknown>;
  metricsDb: Datastore<unknown>;
  settingsDb: Datastore<unknown>;
  defaultIntervalMs: number;
};

declare global {
  var lastCompactionTime: number | undefined;
  var currentCompactionIntervalMs: number | undefined;
}

let compactionTimeout: NodeJS.Timeout | null = null;

export function ensureCompactionState(defaultIntervalMs: number): void {
  if (!global.lastCompactionTime) {
    global.lastCompactionTime = Date.now();
  }

  if (!global.currentCompactionIntervalMs) {
    global.currentCompactionIntervalMs = defaultIntervalMs;
  }
}

export function getLastCompactionTime(defaultIntervalMs: number): number {
  ensureCompactionState(defaultIntervalMs);
  return global.lastCompactionTime || Date.now();
}

export function getCurrentCompactionIntervalMs(defaultIntervalMs: number): number {
  ensureCompactionState(defaultIntervalMs);
  return global.currentCompactionIntervalMs || defaultIntervalMs;
}

async function resolveCompactionIntervalMs(input: DbCompactionInput): Promise<number> {
  if (isProtectedDbPhase()) return input.defaultIntervalMs;

  try {
    await input.settingsDb.loadDatabaseAsync();
  } catch {}

  const settings = (await input.settingsDb.findOneAsync({ id: 'global_settings' })) as SettingsRecord;
  const rawMinutes = Number(settings?.memoryResetIntervalMinutes);

  if (Number.isFinite(rawMinutes) && rawMinutes > 0) {
    return rawMinutes * 60 * 1000;
  }

  return input.defaultIntervalMs;
}

export async function scheduleNextCompaction(input: DbCompactionInput): Promise<void> {
  if (isProtectedDbPhase()) return;

  if (compactionTimeout) {
    clearTimeout(compactionTimeout);
  }

  const intervalMs = await resolveCompactionIntervalMs(input);
  global.currentCompactionIntervalMs = intervalMs;
  compactionTimeout = setTimeout(async () => {
    await forceMemoryReset(input);
  }, intervalMs);
  compactionTimeout.unref();
}

export async function forceMemoryReset(input: DbCompactionInput): Promise<void> {
  if (isProtectedDbPhase()) return;

  console.log('[NeDB-Compact] Iniciando compactación manual de base de datos y liberación de memoria...');
  await Promise.all([
    input.connectorsDb
      .compactDatafileAsync()
      .catch(err => console.error('[NeDB-Compact] connectors.db error:', err)),
    input.metricsDb
      .compactDatafileAsync()
      .catch(err => console.error('[NeDB-Compact] metrics.db error:', err)),
    input.settingsDb
      .compactDatafileAsync()
      .catch(err => console.error('[NeDB-Compact] settings.db error:', err))
  ]);

  if (typeof global.gc === 'function') {
    try {
      console.log('[NeDB-Compact] Forzando recolección de basura (gc)...');
      global.gc();
    } catch {}
  }

  global.lastCompactionTime = Date.now();
  await scheduleNextCompaction(input);
}
