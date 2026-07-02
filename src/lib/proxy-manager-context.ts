import type { Connector } from "./connectors";
import type { GlobalSettings } from "./settings";

export interface ProxyPortRuntimeContext {
  connectors: Connector[];
  settings: GlobalSettings;
}

export async function loadProxyPortRuntimeContext(
  port: number,
  input: {
    loadConnectors: () => Promise<Connector[]>;
    loadSettings: () => Promise<GlobalSettings>;
  },
): Promise<ProxyPortRuntimeContext> {
  const [connectors, settings] = await Promise.all([
    input.loadConnectors(),
    input.loadSettings(),
  ]);

  return {
    connectors: connectors.filter((connector) => connector.port === port),
    settings,
  };
}

export function listProxyPorts(connectors: Connector[]): number[] {
  return Array.from(new Set(connectors.map((connector) => connector.port)));
}

export async function findProxyConnectorPort(
  connectorId: string,
  loadConnectors: () => Promise<Connector[]>,
): Promise<number | null> {
  const connectors = await loadConnectors();
  const connector = connectors.find((entry) => entry.id === connectorId);
  return connector ? connector.port : null;
}
