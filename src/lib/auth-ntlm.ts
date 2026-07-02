export const CRM_NTLM_PROVIDER_ID = "ntlm-login";
export const CORE_NTLM_PROVIDER_ID = "core-ntlm-login";

export type { CrmNtlmAuthUser, CoreNtlmAuthUser } from "./auth-ntlm-users";
export {
  createCoreNtlmAuthUser,
  createCrmNtlmAuthUser,
} from "./auth-ntlm-users";

export {
  applyNtlmJwtClaims,
  applyNtlmSessionClaims,
} from "./auth-ntlm-claims";

export type {
  CoreNtlmSessionCredentials,
  CrmNtlmSessionCredentials,
} from "./auth-ntlm-session";
export {
  getCoreNtlmSessionCredentials,
  getCrmNtlmSessionCredentials,
  getPreferredSessionUsername,
  hasCoreNtlmSessionForConnector,
  hasCrmNtlmSessionForConnector,
} from "./auth-ntlm-session";
