import { CORE_NTLM_PROVIDER_ID, CRM_NTLM_PROVIDER_ID } from './auth-ntlm';
import type { CoreNtlmAuthUser, CrmNtlmAuthUser } from './auth-ntlm-users';

type NtlmTokenClaims = {
  crmUser?: string;
  crmPass?: string;
  crmDomain?: string;
  crmConnectorId?: string;
  coreUser?: string;
  corePass?: string;
  coreDomain?: string;
  coreConnectorId?: string;
};

export function applyNtlmJwtClaims<TToken extends Record<string, unknown>>(
  token: TToken,
  user: CrmNtlmAuthUser | CoreNtlmAuthUser | null | undefined,
  provider?: string,
): TToken & NtlmTokenClaims {
  const mutableToken = token as TToken & NtlmTokenClaims;

  if (user && provider === CRM_NTLM_PROVIDER_ID) {
    const crmUser = user as CrmNtlmAuthUser;
    mutableToken.crmUser = crmUser.crmUser;
    mutableToken.crmPass = crmUser.crmPass;
    mutableToken.crmDomain = crmUser.crmDomain;
    mutableToken.crmConnectorId = crmUser.crmConnectorId;
  }

  if (user && provider === CORE_NTLM_PROVIDER_ID) {
    const coreUser = user as CoreNtlmAuthUser;
    mutableToken.coreUser = coreUser.coreUser;
    mutableToken.corePass = coreUser.corePass;
    mutableToken.coreDomain = coreUser.coreDomain;
    mutableToken.coreConnectorId = coreUser.coreConnectorId;
  }

  return mutableToken;
}

export function applyNtlmSessionClaims<TSession extends Record<string, unknown>>(
  session: TSession,
  token: Record<string, unknown>,
): TSession & NtlmTokenClaims {
  const mutableSession = session as TSession & NtlmTokenClaims;
  const claimToken = token as Record<string, unknown> & NtlmTokenClaims;

  if (claimToken.crmUser) {
    mutableSession.crmUser = claimToken.crmUser;
    mutableSession.crmPass = claimToken.crmPass;
    mutableSession.crmDomain = claimToken.crmDomain;
    mutableSession.crmConnectorId = claimToken.crmConnectorId;
  }

  if (claimToken.coreUser) {
    mutableSession.coreUser = claimToken.coreUser;
    mutableSession.corePass = claimToken.corePass;
    mutableSession.coreDomain = claimToken.coreDomain;
    mutableSession.coreConnectorId = claimToken.coreConnectorId;
  }

  return mutableSession;
}
