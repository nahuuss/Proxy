import { Connector } from "../connectors";
import { ConnectorProductType, DEFAULT_PRODUCT_TYPE, ProductCatalogEntry } from "../product-schema";
import { isCoreNtlmPath } from "../core-ntlm";
import { bankProductProfile } from "./bank";
import { ProductProfileDefinition } from "./base";
import { coreProductProfile } from "./core";
import { dynamicsCrmRuntimeProfile } from "./dynamics-crm";
import { genericProductProfile } from "./generic";
import { serenaTestProductProfile } from "./serena-test";

const PRODUCT_PROFILES: Record<ConnectorProductType, ProductProfileDefinition> = {
  generic: genericProductProfile,
  "dynamics-crm": dynamicsCrmRuntimeProfile,
  core: coreProductProfile,
  bank: bankProductProfile,
  "serena-test": serenaTestProductProfile,
};

function normalizeProfileProductType(productType?: string): ConnectorProductType {
  return PRODUCT_PROFILES[productType as ConnectorProductType] ? (productType as ConnectorProductType) : DEFAULT_PRODUCT_TYPE;
}

export function getProductProfile(productType?: string): ProductProfileDefinition {
  return PRODUCT_PROFILES[normalizeProfileProductType(productType)];
}

export function getAllProductProfiles(): ProductProfileDefinition[] {
  return Object.values(PRODUCT_PROFILES);
}

export function getProductCatalogEntries(): ProductCatalogEntry[] {
  return getAllProductProfiles().map((profile) => profile.catalog);
}

export function getProductBadgeLabel(productType?: string): string | null {
  const profile = getProductProfile(productType);
  return profile.type === DEFAULT_PRODUCT_TYPE ? null : profile.catalog.icon;
}

export interface ProductFieldPresentation {
  entryPathLabel: string;
  entryPathPlaceholder: string;
  entryPathHelp: string;
  coreNtlmDomainHelp: string;
}

export function getProductFieldPresentation(productType?: string): ProductFieldPresentation {
  const profile = getProductProfile(productType);

  if (profile.catalog.contract.normalizesDynamicsCrmPath) {
    return {
      entryPathLabel: "Ruta de organizacion",
      entryPathPlaceholder: "/NOMBREORG/",
      entryPathHelp: "Ruta base de la organizacion CRM. Ej: /SERENAART/ o /Inicio/. El usuario es redirigido aqui tras el login.",
      coreNtlmDomainHelp: "Dominio usado exclusivamente por el flujo NTLM Core del perfil.",
    };
  }

  if (profile.supports.coreNtlmDomain) {
    return {
      entryPathLabel: "Path de entrada",
      entryPathPlaceholder: "/ruta/inicial",
      entryPathHelp: "Ruta inicial opcional a la que el usuario sera redirigido tras el login del conector.",
      coreNtlmDomainHelp: "Dominio usado exclusivamente por el flujo NTLM Core del perfil.",
    };
  }

  return {
    entryPathLabel: "Path de entrada",
    entryPathPlaceholder: "/ruta/inicial",
    entryPathHelp: "Ruta inicial opcional a la que el usuario sera redirigido tras el login del conector.",
    coreNtlmDomainHelp: "Dominio usado exclusivamente por el flujo NTLM Core del perfil.",
  };
}

export function getDefaultProductProfile(): ProductProfileDefinition {
  return PRODUCT_PROFILES[DEFAULT_PRODUCT_TYPE];
}

export function normalizeConnectorWithProfile<T extends Partial<Connector>>(connector: T): T {
  const profile = getProductProfile(connector.connectorType);
  const normalizedType = normalizeProfileProductType(connector.connectorType);
  return {
    ...connector,
    connectorType: normalizedType,
    ...profile.normalizeConnectorConfig({
      ...connector,
      connectorType: normalizedType,
    }),
  };
}

export function isConnectorNtlmActive(connector: Pick<Connector, "connectorType" | "isNtlm">): boolean {
  return getProductProfile(connector.connectorType).usesNtlm(connector);
}

export function requiresConnectorNtlmDomain(connector: Pick<Connector, "connectorType" | "isNtlm">): boolean {
  return getProductProfile(connector.connectorType).requiresNtlmDomain(connector);
}

export function requiresConnectorCoreNtlmDomain(connector: Pick<Connector, "connectorType">): boolean {
  return getProductProfile(connector.connectorType).catalog.contract.requiresCoreNtlmDomain;
}

export function getLegacyForcedExecutionPaths(
  connector: Pick<Connector, "connectorType" | "hbForceUrls">,
): string[] {
  return getProductProfile(connector.connectorType).resolveLegacyForcedExecutionPaths(connector);
}

export function matchesLegacyForcedExecutionPath(
  connector: Pick<Connector, "connectorType" | "hbForceUrls">,
  requestPath: string,
): boolean {
  const normalizedPath = requestPath.trim().toLowerCase();
  return getLegacyForcedExecutionPaths(connector).some((candidate) =>
    normalizedPath === candidate ||
    normalizedPath.startsWith(`${candidate}?`) ||
    normalizedPath.startsWith(candidate),
  );
}

export function getConnectorNtlmDefaultDomain(connector: Partial<Connector>): string | undefined {
  const normalized = normalizeConnectorWithProfile(connector);
  return getProductProfile(normalized.connectorType).resolveNtlmDomain(normalized);
}

export function getConnectorCoreNtlmDefaultDomain(
  connector: Partial<Pick<Connector, "connectorType" | "coreNtlmDomain">>,
): string | undefined {
  const normalized = normalizeConnectorWithProfile(connector);
  if (!requiresConnectorCoreNtlmDomain(normalized)) {
    return undefined;
  }
  return normalized.coreNtlmDomain?.trim() || undefined;
}

export function validateConnectorWithProfile(connector: Partial<Connector>): string[] {
  const normalized = normalizeConnectorWithProfile(connector);
  return getProductProfile(normalized.connectorType).validateConnectorConfig(normalized);
}

export function buildNtlmValidationUrlForConnector(connector: Connector): string | undefined {
  return getProductProfile(connector.connectorType).buildNtlmValidationUrl(connector);
}

export function buildCoreNtlmValidationUrlForConnector(connector: Connector): string | undefined {
  return getProductProfile(connector.connectorType).buildCoreNtlmValidationUrl(connector);
}

export function normalizeProxyRequestUrlForConnector(connector: Connector, requestUrl: string): string {
  return getProductProfile(connector.connectorType).normalizeProxyRequestUrl(requestUrl, connector);
}

export function rewriteResponseBodyForConnector(
  connector: Connector,
  body: string,
  context: { incomingHost: string; proto: string },
): string {
  return getProductProfile(connector.connectorType).rewriteResponseBody(body, {
    connector,
    incomingHost: context.incomingHost,
    proto: context.proto,
  });
}

export function resolveRootEntryPathForConnector(connector: Pick<Connector, "connectorType" | "entryPath">): string | undefined {
  const profile = getProductProfile(connector.connectorType);
  if (!profile.supports.rootEntryRedirect) return undefined;
  return profile.resolveRootEntryPath(connector);
}

export function requiresConnectorSessionForNtlm(connector: Pick<Connector, "connectorType" | "isNtlm">): boolean {
  return isConnectorNtlmActive(connector);
}

export function buildConnectorNtlmLoginUrl(
  connector: Pick<Connector, "id" | "connectorType" | "isNtlm" | "ntlmDomain">,
  callbackUrl: string,
): string {
  const query = new URLSearchParams({
    callbackUrl,
    connectorId: connector.id,
  });
  const domain = getConnectorNtlmDefaultDomain(connector);
  if (domain) query.set("domain", domain);
  return `/login/ntlm?${query.toString()}`;
}

export function buildConnectorCoreNtlmLoginUrl(
  connector: Pick<Connector, "id" | "connectorType" | "coreNtlmDomain">,
  callbackUrl: string,
): string {
  const query = new URLSearchParams({
    callbackUrl,
    connectorId: connector.id,
  });
  const domain = getConnectorCoreNtlmDefaultDomain(connector);
  if (domain) {
    query.set("domain", domain);
  }
  return `/login/core-ntlm?${query.toString()}`;
}

export function requiresCoreNtlmSessionForRequest(
  connector: Pick<Connector, "connectorType">,
  requestUrl?: string,
): boolean {
  return requiresConnectorCoreNtlmDomain(connector) && isCoreNtlmPath(requestUrl);
}
