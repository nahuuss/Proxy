import http from "http";
import https from "https";
import { logSSO } from "./logger-sso";

export interface NtlmHttpClient {
  get(
    options: Record<string, unknown>,
    callback: (error: any, response: any) => void,
  ): void;
}

export interface NtlmValidationSuccess {
  valid: true;
  domain: string;
}

export interface NtlmValidationFailure {
  valid: false;
  error: string;
}

export type NtlmValidationResult = NtlmValidationSuccess | NtlmValidationFailure;

export function buildNtlmAgent(url: string, strictTls: boolean) {
  return url.startsWith("https://")
    ? new https.Agent({ keepAlive: true, rejectUnauthorized: strictTls })
    : new http.Agent({ keepAlive: true });
}

export async function executeNtlmValidation(input: {
  connectorId: string;
  username: string;
  password: string;
  domain: string;
  validationUrl: string;
  strictTls: boolean;
  httpntlm: NtlmHttpClient;
  logPrefix: string;
}): Promise<boolean> {
  const agent = buildNtlmAgent(input.validationUrl, input.strictTls);
  logSSO(
    input.connectorId,
    `[${input.logPrefix}] Validando credenciales contra ${input.validationUrl} | strictTls=${input.strictTls}`,
  );

  return await new Promise<boolean>((resolve) => {
    input.httpntlm.get(
      {
        username: input.username,
        password: input.password,
        domain: input.domain,
        workstation: "",
        url: input.validationUrl,
        agent,
        timeout: 15000,
      },
      (err: any, res: any) => {
        if (err) {
          logSSO(input.connectorId, `[${input.logPrefix}] Error validando NTLM: ${err.message || err}`);
          resolve(false);
          return;
        }
        logSSO(input.connectorId, `[${input.logPrefix}] Respuesta NTLM status=${res?.statusCode}`);
        resolve(res.statusCode !== 401);
      },
    );
  });
}
