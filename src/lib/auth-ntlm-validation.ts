import { logSSO } from "./logger-sso";
import {
  executeNtlmValidation,
  type NtlmHttpClient,
  type NtlmValidationResult,
} from "./auth-ntlm-validation-shared";
import {
  resolveCoreNtlmValidationContext,
  resolveCrmNtlmValidationContext,
} from "./auth-ntlm-validation-profiles";
import type { Connector } from "./connectors";

export interface ValidateCrmNtlmInput {
  connector: Connector | undefined;
  connectorId: string;
  username: string;
  password: string;
  domain?: string;
  httpntlm: NtlmHttpClient;
}

export interface ValidateCoreNtlmInput {
  connector: Connector | undefined;
  connectorId: string;
  username: string;
  password: string;
  domain?: string;
  httpntlm: NtlmHttpClient;
}

export async function validateCrmNtlmCredentials(input: ValidateCrmNtlmInput): Promise<NtlmValidationResult> {
  const context = resolveCrmNtlmValidationContext({
    connector: input.connector,
    connectorId: input.connectorId,
    domain: input.domain,
  });
  if ("valid" in context) {
    return context;
  }

  try {
    const valid = await executeNtlmValidation({
      connectorId: input.connectorId,
      username: input.username,
      password: input.password,
      domain: context.resolvedDomain,
      validationUrl: context.validationUrl,
      strictTls: context.strictTls,
      httpntlm: input.httpntlm,
      logPrefix: "NTLM-AUTH",
    });

    if (!valid) {
      logSSO(input.connectorId, `[NTLM-AUTH] Credenciales rechazadas para usuario=${input.username}.`);
      return { valid: false, error: "invalid-credentials" };
    }

    return { valid: true, domain: context.resolvedDomain };
  } catch (error: any) {
    logSSO(input.connectorId, `[NTLM-AUTH] Excepcion inesperada durante validacion: ${error?.message || error}`);
    return { valid: false, error: "unexpected-error" };
  }
}

export async function validateCoreNtlmCredentials(input: ValidateCoreNtlmInput): Promise<NtlmValidationResult> {
  const context = resolveCoreNtlmValidationContext({
    connector: input.connector,
    connectorId: input.connectorId,
    domain: input.domain,
  });
  if ("valid" in context) {
    return context;
  }

  try {
    const valid = await executeNtlmValidation({
      connectorId: input.connectorId,
      username: input.username,
      password: input.password,
      domain: context.resolvedDomain,
      validationUrl: context.validationUrl,
      strictTls: context.strictTls,
      httpntlm: input.httpntlm,
      logPrefix: "CORE-NTLM-AUTH",
    });

    if (!valid) {
      return { valid: false, error: "invalid-credentials" };
    }

    return { valid: true, domain: context.resolvedDomain };
  } catch {
    logSSO(input.connectorId, "[CORE-NTLM-AUTH] Excepcion inesperada durante validacion.");
    return { valid: false, error: "unexpected-error" };
  }
}

export type { NtlmHttpClient, NtlmValidationResult };
