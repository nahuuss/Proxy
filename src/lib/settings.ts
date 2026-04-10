import { settingsDb } from './db';

export interface GlobalSettings {
  id: string;
  internalTarget: string;
  publicHost: string;
  bypassAuth: boolean;
  authUrl: string;
}

const DEFAULT_ID = "global_settings";

export async function getSettings(): Promise<GlobalSettings> {
  try { await settingsDb.loadDatabaseAsync(); } catch(e) {}
  const settings = await settingsDb.findOneAsync({ id: DEFAULT_ID });
  
  if (settings) {
    return settings as unknown as GlobalSettings;
  }

  // MIGRACIÓN: Si no hay en DB, tomar de env y guardar
  const initialSettings: GlobalSettings = {
    id: DEFAULT_ID,
    internalTarget: process.env.INTERNAL_TARGET || "",
    publicHost: process.env.PUBLIC_HOST || "",
    bypassAuth: process.env.BYPASS_AUTH === "true",
    authUrl: process.env.AUTH_URL || "http://localhost:3000"
  };

  await settingsDb.insertAsync(initialSettings);
  return initialSettings;
}

export async function updateSettings(updates: Partial<Omit<GlobalSettings, 'id'>>) {
  await settingsDb.updateAsync(
    { id: DEFAULT_ID },
    { $set: updates },
    { upsert: true }
  );
}
