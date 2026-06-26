import { Connector } from "./connectors";

export const CORE_NTLM_LOGIN_PATH = "/LoginExterno.aspx";

export function isCoreNtlmPath(url?: string): boolean {
  const path = (url || "").split("?")[0];
  return path.toLowerCase() === CORE_NTLM_LOGIN_PATH.toLowerCase();
}

export function buildCoreNtlmValidationUrl(connector: Connector): string {
  return `${connector.targetUrl.replace(/\/$/, "")}${CORE_NTLM_LOGIN_PATH}`;
}

export function hasCoreNtlmSessionForConnector(session: any, connectorId: string): boolean {
  return !!session?.coreUser &&
    !!session?.corePass &&
    !!session?.coreDomain &&
    session?.coreConnectorId === connectorId;
}
