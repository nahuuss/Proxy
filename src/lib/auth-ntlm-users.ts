export interface CrmNtlmAuthUser {
  id: string;
  email: string;
  name: string;
  crmUser: string;
  crmPass: string;
  crmDomain: string;
  crmConnectorId: string;
}

export interface CoreNtlmAuthUser {
  id: string;
  email: string;
  name: string;
  coreUser: string;
  corePass: string;
  coreDomain: string;
  coreConnectorId: string;
}

export function createCrmNtlmAuthUser(input: {
  connectorId: string;
  username: string;
  password: string;
  domain: string;
}): CrmNtlmAuthUser {
  return {
    id: `${input.connectorId}:${input.username}`,
    email: `${input.username}@${input.domain}`,
    name: input.username,
    crmUser: input.username,
    crmPass: input.password,
    crmDomain: input.domain,
    crmConnectorId: input.connectorId,
  };
}

export function createCoreNtlmAuthUser(input: {
  connectorId: string;
  username: string;
  password: string;
  domain: string;
}): CoreNtlmAuthUser {
  return {
    id: `${input.connectorId}:${input.username}`,
    email: `${input.username}@${input.domain}`,
    name: input.username,
    coreUser: input.username,
    corePass: input.password,
    coreDomain: input.domain,
    coreConnectorId: input.connectorId,
  };
}
