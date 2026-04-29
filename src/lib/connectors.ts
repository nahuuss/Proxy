import { connectorsDb } from './db';
import fs from 'fs/promises';
import path from 'path';

export interface Connector {
  id: string;
  name: string;
  description: string;
  port: number;
  targetUrl: string;
  publicHost: string;
  isActive: boolean;
  bypassAuth?: boolean;
  strictTls?: boolean;
  hbForceUrls?: string[];
  connectorType?: 'generic' | 'dynamics-crm' | 'core' | 'bank' | 'serena-test';
  isNtlm?: boolean;
  ntlmDomain?: string;
  entryPath?: string;
  stats?: {
    requests: number;
    bytes: number;
    latency?: number;
    activePing?: number;
    isOnline?: boolean;
  };
}

const CONNECTORS_FILE = path.join(process.cwd(), 'src/data/connectors.json');

let migrationPromise: Promise<void> | null = null;

// Migración inicial de JSON a NeDB (solo si la DB está vacía)
async function migrateIfNeeded() {
  try {
    const count = await connectorsDb.countAsync({});
    if (count === 0) {
      const data = await fs.readFile(CONNECTORS_FILE, 'utf8');
      const connectors = JSON.parse(data);
      if (Array.isArray(connectors) && connectors.length > 0) {
        await connectorsDb.insertAsync(connectors);
        console.log(`[DB] Migrados ${connectors.length} conectores desde JSON a NeDB.`);
      }
    }
  } catch (error) {
    // Si falla la lectura del JSON o ya no existe, seguimos adelante
  }
}

// Inicializar la migración una sola vez
if (!migrationPromise) {
  migrationPromise = migrateIfNeeded();
}

export async function getConnectors(): Promise<Connector[]> {
  if (migrationPromise) await migrationPromise;
  
  // Forzar recarga desde disco para evitar datos cacheados obsoletos en modo multi-worker de Next.js
  try {
    await connectorsDb.loadDatabaseAsync();
  } catch(e) { /* ignorar ENOENT de concurrencia */ }
  
  return (await connectorsDb.findAsync({})) as unknown as Connector[];
}

export async function addConnector(connector: Omit<Connector, 'isActive'>) {
  const newConnector: Connector = { ...connector, isActive: true };
  await connectorsDb.insertAsync(newConnector);
  return newConnector;
}

export async function getConnectorById(id: string): Promise<Connector | undefined> {
  try { await connectorsDb.loadDatabaseAsync(); } catch(e) {}
  const connector = await connectorsDb.findOneAsync({ id });
  return (connector as unknown as Connector) || undefined;
}

export async function updateConnector(id: string, updates: Partial<Omit<Connector, 'id'>>) {
  await connectorsDb.updateAsync({ id }, { $set: updates }, {});
  return await getConnectorById(id);
}

export async function deleteConnector(id: string) {
  await connectorsDb.removeAsync({ id }, {});
}
