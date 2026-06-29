import { settingsDb, isBuildPhase } from './db';

export interface GlobalSettings {
  id: string;
  internalTarget: string;
  publicHost: string;
  bypassAuth: boolean;
  authUrl: string;
  hbFirstPulse?: number; // Umbral de activación del heartbeat en segundos
  memoryResetIntervalMinutes?: number;
}

const DEFAULT_ID = "global_settings";
const DEFAULT_HB_FIRST_PULSE_SEC = parseInt(process.env.HB_FIRST_PULSE_SEC || "20");
const DEFAULT_MEMORY_RESET_INTERVAL_MINUTES = parseInt(process.env.MEMORY_RESET_INTERVAL_MINUTES || "30");

function normalizeSettings(settings?: Partial<GlobalSettings> | null): GlobalSettings {
  return {
    id: DEFAULT_ID,
    internalTarget: settings?.internalTarget || process.env.INTERNAL_TARGET || "",
    publicHost: settings?.publicHost || process.env.PUBLIC_HOST || "",
    bypassAuth: settings?.bypassAuth ?? (process.env.BYPASS_AUTH === "true"),
    authUrl: settings?.authUrl || process.env.AUTH_URL || "http://localhost:3000",
    hbFirstPulse: settings?.hbFirstPulse !== undefined ? settings.hbFirstPulse : DEFAULT_HB_FIRST_PULSE_SEC,
    memoryResetIntervalMinutes: settings?.memoryResetIntervalMinutes !== undefined ? settings.memoryResetIntervalMinutes : DEFAULT_MEMORY_RESET_INTERVAL_MINUTES,
  };
}

export async function getSettings(): Promise<GlobalSettings> {
  if (isBuildPhase()) {
    return normalizeSettings();
  }

  try { await settingsDb.loadDatabaseAsync(); } catch (e) {}
  const settings = await settingsDb.findOneAsync({ id: DEFAULT_ID });

  if (settings) {
    return normalizeSettings(settings as unknown as GlobalSettings);
  }

  const initialSettings = normalizeSettings();
  await settingsDb.insertAsync(initialSettings);
  return initialSettings;
}

export async function updateSettings(updates: Partial<Omit<GlobalSettings, 'id'>>) {
  await settingsDb.updateAsync(
    { id: DEFAULT_ID },
    { $set: updates },
    { upsert: true }
  );

  const { rescheduleMemoryResetSchedule } = await import("./db");
  await rescheduleMemoryResetSchedule();
}
