import {
  getCoreNtlmSessionCredentials,
  getCrmNtlmSessionCredentials,
  type CoreNtlmSessionCredentials,
  type CrmNtlmSessionCredentials,
} from "./auth-ntlm";
import type { Connector } from "./connectors";
import { hasCoreNtlmSessionForConnector } from "./core-ntlm";
import {
  requiresConnectorSessionForNtlm,
  requiresCoreNtlmSessionForRequest,
} from "./product-profiles";

export type ProxyNtlmSessionResolution =
  | { kind: "none" }
  | { kind: "core"; credentials: CoreNtlmSessionCredentials }
  | { kind: "crm"; credentials: CrmNtlmSessionCredentials }
  | { kind: "crm-missing-session" }
  | { kind: "crm-connector-mismatch"; credentials: CrmNtlmSessionCredentials };

export function resolveProxyNtlmSession(input: {
  connector: Pick<Connector, "id" | "connectorType" | "isNtlm">;
  session: any;
  requestUrl?: string;
}): ProxyNtlmSessionResolution {
  if (
    requiresCoreNtlmSessionForRequest(input.connector, input.requestUrl) &&
    hasCoreNtlmSessionForConnector(input.session, input.connector.id)
  ) {
    const credentials = getCoreNtlmSessionCredentials(input.session);
    if (credentials) {
      return { kind: "core", credentials };
    }
  }

  if (
    requiresConnectorSessionForNtlm(input.connector) &&
    input.session &&
    input.session.crmConnectorId === input.connector.id
  ) {
    const credentials = getCrmNtlmSessionCredentials(input.session);
    if (!credentials) {
      return { kind: "crm-missing-session" };
    }
    if (credentials.connectorId !== input.connector.id) {
      return { kind: "crm-connector-mismatch", credentials };
    }
    return { kind: "crm", credentials };
  }

  return { kind: "none" };
}
