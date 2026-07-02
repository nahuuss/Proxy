import type { Connector } from './connectors';

import { getPort, normalizeHost } from './auth-origin-host';

export function findConnectorByPort(connectors: Connector[], ...hosts: string[]): Connector | undefined {
  for (const host of hosts) {
    const port = getPort(normalizeHost(host));
    if (!port) continue;
    const connector = connectors.find(candidate => candidate.port === port);
    if (connector) return connector;
  }

  if (connectors.length === 1) return connectors[0];
  return undefined;
}
