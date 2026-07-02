import {
  buildDynamicsCrmEntryUrl,
  normalizeDynamicsCrmEntryPath,
  normalizeDynamicsCrmProxyPath,
  rewriteDynamicsCrmClientConfig,
} from "../dynamics-crm";
import { createBaseProductProfile } from "./base";
import { CrmRules } from "../rules/generic";
import { ProductCatalogEntry } from "../product-schema";

const crmRules = new CrmRules();
const dynamicsCrmCatalog: ProductCatalogEntry = {
  value: "dynamics-crm",
  label: "Dynamics CRM",
  icon: "CRM",
  desc: "Microsoft Dynamics CRM on-premise. Habilita NTLM y reescrituras CRM.",
  tooltip: "Mantiene handshake NTLM por request, anti-lockout, reescritura CRM y comportamiento conservador de Heartbeat.",
  defaults: {},
  contract: {
    forcesNtlm: true,
    supportsNtlmToggle: false,
    requiresCoreNtlmDomain: false,
    normalizesDynamicsCrmPath: true,
    rewritesDynamicsCrmClientConfig: true,
    keepsNtlmTransportPerRequest: true,
  },
};
const baseDynamicsCrmProfile = createBaseProductProfile(dynamicsCrmCatalog, crmRules);

export const dynamicsCrmRuntimeProfile = createBaseProductProfile(dynamicsCrmCatalog, crmRules, {
  supports: {
    ntlmToggle: false,
    ntlmDomain: true,
    coreNtlmDomain: false,
    entryPath: true,
    rootEntryRedirect: true,
  },
  normalizeProxyRequestUrl(requestUrl, connector) {
    return normalizeDynamicsCrmProxyPath(requestUrl || "/", connector.entryPath);
  },
  buildNtlmValidationUrl(connector) {
    return buildDynamicsCrmEntryUrl(connector.targetUrl, connector.entryPath);
  },
  rewriteResponseBody(body, context) {
    const rewritten = rewriteDynamicsCrmClientConfig(
      body,
      context.incomingHost,
      context.proto,
      context.connector.entryPath,
    );
    return crmRules.rewriteBody(rewritten);
  },
  normalizeConnectorConfig(connector) {
    const normalized = baseDynamicsCrmProfile.normalizeConnectorConfig(connector);
    return {
      ...normalized,
      ntlmDomain: connector.ntlmDomain?.trim() || undefined,
      entryPath: connector.entryPath ? normalizeDynamicsCrmEntryPath(connector.entryPath) : undefined,
      isNtlm: true,
    };
  },
  resolveRootEntryPath(connector) {
    return normalizeDynamicsCrmEntryPath(connector.entryPath);
  },
});
