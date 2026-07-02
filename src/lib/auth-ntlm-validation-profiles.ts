import type { Connector } from "./connectors";
import { logSSO } from "./logger-sso";
import {
  buildCoreNtlmValidationUrlForConnector,
  buildNtlmValidationUrlForConnector,
  getConnectorCoreNtlmDefaultDomain,
  getConnectorNtlmDefaultDomain,
  requiresConnectorCoreNtlmDomain,
  requiresConnectorSessionForNtlm,
} from "./product-profiles";
import type {
  NtlmValidationFailure,
} from "./auth-ntlm-validation-shared";

export function resolveCrmNtlmValidationContext(input: {
  connector: Connector | undefined;
  connectorId: string;
  domain?: string;
}):
  | NtlmValidationFailure
  | {
      validationUrl: string;
      resolvedDomain: string;
      strictTls: boolean;
    } {
  if (!input.connector || !input.connector.isActive || !requiresConnectorSessionForNtlm(input.connector)) {
    logSSO(input.connectorId, "[NTLM-AUTH] Conector invalido o no habilitado para CRM NTLM.");
    return { valid: false, error: "invalid-connector" };
  }

  const validationUrl = buildNtlmValidationUrlForConnector(input.connector);
  if (!validationUrl) {
    logSSO(
      input.connectorId,
      `[NTLM-AUTH] El perfil ${input.connector.connectorType || "generic"} no definio URL de validacion NTLM.`,
    );
    return { valid: false, error: "missing-validation-url" };
  }

  return {
    validationUrl,
    resolvedDomain: (input.domain || getConnectorNtlmDefaultDomain(input.connector) || "").trim(),
    strictTls: input.connector.strictTls === true,
  };
}

export function resolveCoreNtlmValidationContext(input: {
  connector: Connector | undefined;
  connectorId: string;
  domain?: string;
}):
  | NtlmValidationFailure
  | {
      validationUrl: string;
      resolvedDomain: string;
      strictTls: boolean;
    } {
  const connectorCoreDomain = input.connector ? getConnectorCoreNtlmDefaultDomain(input.connector) : undefined;
  if (
    !input.connector ||
    !requiresConnectorCoreNtlmDomain(input.connector) ||
    !input.connector.isActive ||
    !connectorCoreDomain
  ) {
    logSSO(input.connectorId, "[CORE-NTLM-AUTH] Conector invalido o sin dominio NTLM configurado.");
    return { valid: false, error: "invalid-connector" };
  }

  const validationUrl = buildCoreNtlmValidationUrlForConnector(input.connector);
  if (!validationUrl) {
    logSSO(
      input.connectorId,
      `[CORE-NTLM-AUTH] El perfil ${input.connector.connectorType || "generic"} no definio URL de validacion Core NTLM.`,
    );
    return { valid: false, error: "missing-validation-url" };
  }

  return {
    validationUrl,
    resolvedDomain: (input.domain || connectorCoreDomain || "").trim(),
    strictTls: input.connector.strictTls === true,
  };
}
