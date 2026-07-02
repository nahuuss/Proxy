import type { Connector } from "./connectors";
import type { ProductConfig } from "./product-catalog";

type ConnectorRuntimeComparable = Pick<
  Connector,
  | "targetUrl"
  | "publicHost"
  | "port"
  | "bypassAuth"
  | "strictTls"
  | "connectorType"
  | "productConfig"
  | "hbForceUrls"
  | "isNtlm"
  | "ntlmDomain"
  | "coreNtlmDomain"
  | "entryPath"
  | "harLog"
  | "trafficLog"
  | "hbFirstPulse"
>;

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, sortValue(nestedValue)]),
    );
  }

  return value;
}

export function getConnectorRuntimeSnapshot(
  connector: Partial<ConnectorRuntimeComparable>,
): ConnectorRuntimeComparable {
  return {
    targetUrl: connector.targetUrl || "",
    publicHost: connector.publicHost || "",
    port: connector.port || 0,
    bypassAuth: connector.bypassAuth === true,
    strictTls: connector.strictTls === true,
    connectorType: connector.connectorType,
    productConfig: sortValue(connector.productConfig || {}) as ProductConfig,
    hbForceUrls: [...(connector.hbForceUrls || [])],
    isNtlm: connector.isNtlm === true,
    ntlmDomain: connector.ntlmDomain || "",
    coreNtlmDomain: connector.coreNtlmDomain || "",
    entryPath: connector.entryPath || "",
    harLog: connector.harLog === true,
    trafficLog: connector.trafficLog === true,
    hbFirstPulse: connector.hbFirstPulse || 0,
  };
}

export function hasConnectorRuntimeConfigChanged(
  previous: Partial<ConnectorRuntimeComparable>,
  next: Partial<ConnectorRuntimeComparable>,
): boolean {
  return JSON.stringify(getConnectorRuntimeSnapshot(previous)) !== JSON.stringify(getConnectorRuntimeSnapshot(next));
}
