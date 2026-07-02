export interface CrmNtlmSessionCredentials {
  username: string;
  password: string;
  domain: string;
  connectorId: string;
}

export interface CoreNtlmSessionCredentials {
  username: string;
  password: string;
  domain: string;
  connectorId: string;
}

type CrmSessionLike = {
  crmUser?: string;
  crmPass?: string;
  crmDomain?: string;
  crmConnectorId?: string;
};

type CoreSessionLike = {
  coreUser?: string;
  corePass?: string;
  coreDomain?: string;
  coreConnectorId?: string;
};

type UserSessionLike = {
  user?: {
    email?: string;
    name?: string;
  };
};

export function hasCrmNtlmSessionForConnector(
  session: CrmSessionLike | null | undefined,
  connectorId: string,
): boolean {
  return !!session?.crmUser &&
    !!session?.crmPass &&
    !!session?.crmDomain &&
    session?.crmConnectorId === connectorId;
}

export function hasCoreNtlmSessionForConnector(
  session: CoreSessionLike | null | undefined,
  connectorId: string,
): boolean {
  return !!session?.coreUser &&
    !!session?.corePass &&
    !!session?.coreDomain &&
    session?.coreConnectorId === connectorId;
}

export function getCrmNtlmSessionCredentials(
  session: CrmSessionLike | null | undefined,
): CrmNtlmSessionCredentials | null {
  if (!session?.crmUser || !session?.crmPass || !session?.crmDomain || !session?.crmConnectorId) {
    return null;
  }

  return {
    username: session.crmUser,
    password: session.crmPass,
    domain: session.crmDomain,
    connectorId: session.crmConnectorId,
  };
}

export function getCoreNtlmSessionCredentials(
  session: CoreSessionLike | null | undefined,
): CoreNtlmSessionCredentials | null {
  if (!session?.coreUser || !session?.corePass || !session?.coreDomain || !session?.coreConnectorId) {
    return null;
  }

  return {
    username: session.coreUser,
    password: session.corePass,
    domain: session.coreDomain,
    connectorId: session.coreConnectorId,
  };
}

export function getPreferredSessionUsername(
  session: (CrmSessionLike & CoreSessionLike & UserSessionLike) | null | undefined,
): string {
  return session?.crmUser ||
    session?.coreUser ||
    session?.user?.email ||
    session?.user?.name ||
    'anonymous';
}
