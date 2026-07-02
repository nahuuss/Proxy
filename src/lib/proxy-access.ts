import type { Connector } from "./connectors";
import { isLocalHost } from "./auth-origin";
import {
  normalizeProxyRequestUrlForConnector,
  requiresConnectorSessionForNtlm,
  requiresCoreNtlmSessionForRequest,
} from "./product-profiles";

export interface ProxyAccessRequirements {
  isLocalHost: boolean;
  connectorBypass: boolean;
  requiresAuth: boolean;
  needsSessionForNtlm: boolean;
  needsCoreNtlmSession: boolean;
}

export function getProxyAccessRequirements(input: {
  connector: Connector;
  hostHeader: string;
  settingsBypass: boolean;
  requestUrl?: string;
  normalizeRequestUrl?: boolean;
}): ProxyAccessRequirements {
  const isLocal = isLocalHost(input.hostHeader);
  const connectorBypass = input.connector.bypassAuth === true;
  const normalizedRequestUrl = input.normalizeRequestUrl
    ? normalizeProxyRequestUrlForConnector(input.connector, input.requestUrl || "/")
    : (input.requestUrl || "/");

  return {
    isLocalHost: isLocal,
    connectorBypass,
    requiresAuth: !input.settingsBypass && !isLocal && !connectorBypass,
    needsSessionForNtlm: requiresConnectorSessionForNtlm(input.connector),
    needsCoreNtlmSession: requiresCoreNtlmSessionForRequest(input.connector, normalizedRequestUrl),
  };
}
