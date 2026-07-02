import fs from 'fs/promises';
import path from 'path';

import { connectorsDb, isBuildPhase } from './db';

const CONNECTORS_FILE = path.join(process.cwd(), 'src/data/connectors.json');

export async function migrateConnectorsIfNeeded(): Promise<void> {
  if (isBuildPhase()) return;

  try {
    const count = await connectorsDb.countAsync({});
    if (count !== 0) return;

    const data = await fs.readFile(CONNECTORS_FILE, 'utf8');
    const connectors = JSON.parse(data);
    if (Array.isArray(connectors) && connectors.length > 0) {
      await connectorsDb.insertAsync(connectors);
      console.log(`[DB] Migrados ${connectors.length} conectores desde JSON a NeDB.`);
    }
  } catch {
    // Si falla la lectura del JSON o ya no existe, seguimos adelante.
  }
}

export function createConnectorsMigrationRunner(): Promise<void> {
  return migrateConnectorsIfNeeded();
}
