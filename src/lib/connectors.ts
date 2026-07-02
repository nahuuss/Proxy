import { isBuildPhase } from './db';
import { type ConnectorProductType, type ProductConfig } from './product-catalog';
import { createConnectorsMigrationRunner } from './connectors-migration';
import { normalizeConnector } from './connectors-normalize';
import {
  deleteConnectorRecord,
  findAllConnectors,
  findConnectorByIdRecord,
  insertConnectorRecord,
  reloadConnectorsDb,
  updateConnectorRecord,
} from './connectors-store';

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
  connectorType?: ConnectorProductType;
  productConfig?: ProductConfig;
  isNtlm?: boolean;
  ntlmDomain?: string;
  coreNtlmDomain?: string;
  entryPath?: string;
  harLog?: boolean;
  trafficLog?: boolean;
  ssoLog?: boolean;
  hbLog?: boolean;
  hbFirstPulse?: number;
  trafficRetentionValue?: number;
  trafficRetentionUnit?: 'seconds' | 'minutes' | 'hours' | 'days';
  stats?: {
    requests: number;
    bytes: number;
    latency?: number;
    activePing?: number;
    isOnline?: boolean;
  };
}

let migrationPromise: Promise<void> | null = null;

if (!migrationPromise) {
  migrationPromise = createConnectorsMigrationRunner();
}

export async function getConnectors(): Promise<Connector[]> {
  if (isBuildPhase()) return [];
  if (migrationPromise) await migrationPromise;

  await reloadConnectorsDb();
  const connectors = await findAllConnectors();
  return connectors.map(normalizeConnector);
}

export async function addConnector(connector: Omit<Connector, 'isActive'>): Promise<Connector> {
  const newConnector: Connector = normalizeConnector({ ...connector, isActive: true });
  await insertConnectorRecord(newConnector);
  return newConnector;
}

export async function getConnectorById(id: string): Promise<Connector | undefined> {
  if (isBuildPhase()) return undefined;

  await reloadConnectorsDb();
  const connector = await findConnectorByIdRecord(id);
  return connector ? normalizeConnector(connector) : undefined;
}

export async function updateConnector(
  id: string,
  updates: Partial<Omit<Connector, 'id'>>,
): Promise<Connector | undefined> {
  const current = await getConnectorById(id);
  const normalizedUpdates = current ? normalizeConnector({ ...current, ...updates, id }) : updates;
  await updateConnectorRecord(id, normalizedUpdates);
  return await getConnectorById(id);
}

export async function deleteConnector(id: string): Promise<void> {
  await deleteConnectorRecord(id);
}
