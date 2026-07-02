import { connectorsDb } from './db';

import type { Connector } from './connectors';

export async function reloadConnectorsDb(): Promise<void> {
  try {
    await connectorsDb.loadDatabaseAsync();
  } catch {
    // Ignorar ENOENT de concurrencia en multi-worker.
  }
}

export async function findAllConnectors(): Promise<Connector[]> {
  return (await connectorsDb.findAsync({})) as unknown as Connector[];
}

export async function findConnectorByIdRecord(id: string): Promise<Connector | undefined> {
  const connector = await connectorsDb.findOneAsync({ id });
  return connector ? (connector as unknown as Connector) : undefined;
}

export async function insertConnectorRecord(connector: Connector): Promise<void> {
  await connectorsDb.insertAsync(connector);
}

export async function updateConnectorRecord(
  id: string,
  updates: Partial<Omit<Connector, 'id'>>,
): Promise<void> {
  await connectorsDb.updateAsync({ id }, { $set: updates }, {});
}

export async function deleteConnectorRecord(id: string): Promise<void> {
  await connectorsDb.removeAsync({ id }, {});
}
