import { Connector } from "../connectors";
import { ConnectorRules } from "../rules/base";
import {
  ConnectorProductType,
  ProductCatalogEntry,
} from "../product-schema";

export interface ProductBodyRewriteContext {
  incomingHost: string;
  proto: string;
  connector: Connector;
}

export interface ProductProfileDefinition {
  type: ConnectorProductType;
  catalog: ProductCatalogEntry;
  rules: ConnectorRules;
  supports: {
    ntlmToggle: boolean;
    ntlmDomain: boolean;
    coreNtlmDomain: boolean;
    entryPath: boolean;
    rootEntryRedirect: boolean;
  };
  normalizeProxyRequestUrl(requestUrl: string, connector: Connector): string;
  rewriteResponseBody(body: string, context: ProductBodyRewriteContext): string;
  normalizeConnectorConfig(connector: Partial<Connector>): Partial<Connector>;
  resolveLegacyForcedExecutionPaths(connector: Pick<Connector, "hbForceUrls">): string[];
  resolveNtlmDomain(connector: Partial<Connector>): string | undefined;
  usesNtlm(connector: Pick<Connector, "isNtlm">): boolean;
  requiresNtlmDomain(connector: Pick<Connector, "isNtlm">): boolean;
  buildNtlmValidationUrl(connector: Connector): string | undefined;
  buildCoreNtlmValidationUrl(connector: Connector): string | undefined;
  validateConnectorConfig(connector: Partial<Connector>): string[];
  resolveRootEntryPath(connector: Pick<Connector, "entryPath">): string | undefined;
}

function normalizeLegacyForcedExecutionPath(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function createBaseProductProfile(
  catalog: ProductCatalogEntry,
  rules: ConnectorRules,
  overrides?: Partial<ProductProfileDefinition>,
): ProductProfileDefinition {
  return {
    type: catalog.value,
    catalog,
    rules,
    supports: {
      ntlmToggle: true,
      ntlmDomain: false,
      coreNtlmDomain: false,
      entryPath: true,
      rootEntryRedirect: true,
      ...(overrides?.supports || {}),
    },
    normalizeProxyRequestUrl(requestUrl: string) {
      return requestUrl || "/";
    },
    rewriteResponseBody(body: string) {
      return rules.rewriteBody(body);
    },
    normalizeConnectorConfig(connector: Partial<Connector>) {
      const normalized: Partial<Connector> = { ...connector };
      if (!this.supports.ntlmToggle) normalized.isNtlm = this.catalog.contract.forcesNtlm;
      if (this.catalog.contract.forcesNtlm) normalized.isNtlm = true;
      if (!this.supports.ntlmDomain) normalized.ntlmDomain = undefined;
      if (!this.supports.coreNtlmDomain) normalized.coreNtlmDomain = undefined;
      if (!this.supports.entryPath) normalized.entryPath = undefined;
      return normalized;
    },
    resolveLegacyForcedExecutionPaths(connector: Pick<Connector, "hbForceUrls">) {
      return Array.from(
        new Set(
          (connector.hbForceUrls ?? [])
            .map(normalizeLegacyForcedExecutionPath)
            .filter(Boolean),
        ),
      );
    },
    resolveNtlmDomain(connector: Partial<Connector>) {
      const normalized = this.normalizeConnectorConfig(connector);
      return normalized.ntlmDomain?.trim() || undefined;
    },
    usesNtlm(connector: Pick<Connector, "isNtlm">) {
      if (this.catalog.contract.forcesNtlm) return true;
      if (!this.supports.ntlmToggle) return false;
      return connector.isNtlm === true;
    },
    requiresNtlmDomain(connector: Pick<Connector, "isNtlm">) {
      return this.supports.ntlmDomain && this.usesNtlm(connector);
    },
    buildNtlmValidationUrl() {
      return undefined;
    },
    buildCoreNtlmValidationUrl() {
      return undefined;
    },
    validateConnectorConfig(connector: Partial<Connector>) {
      const normalized = this.normalizeConnectorConfig(connector);
      const errors: string[] = [];

      if (this.catalog.contract.requiresCoreNtlmDomain && !normalized.coreNtlmDomain?.trim()) {
        errors.push("El perfil requiere Dominio NTLM Core.");
      }

      if (this.requiresNtlmDomain({ isNtlm: normalized.isNtlm }) && !normalized.ntlmDomain?.trim()) {
        errors.push("El perfil requiere Dominio NTLM.");
      }

      return errors;
    },
    resolveRootEntryPath(connector: Pick<Connector, "entryPath">) {
      return connector.entryPath?.trim() || undefined;
    },
    ...overrides,
  };
}
