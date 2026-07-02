import { createBaseProductProfile } from "./base";
import { GenericRules } from "../rules/generic";
import { ProductCatalogEntry } from "../product-schema";

const genericCatalog: ProductCatalogEntry = {
  value: "generic",
  label: "Generico",
  icon: "Link",
  desc: "Proxy HTTP/HTTPS estandar. Sin customizaciones especificas.",
  tooltip: "Solo activa el Heartbeat para navegaciones GET tradicionales. Sin reescrituras especiales ni soporte para uploads largos.",
  defaults: {},
  contract: {
    forcesNtlm: false,
    supportsNtlmToggle: true,
    requiresCoreNtlmDomain: false,
    normalizesDynamicsCrmPath: false,
    rewritesDynamicsCrmClientConfig: false,
    keepsNtlmTransportPerRequest: false,
  },
};

export const genericProductProfile = createBaseProductProfile(genericCatalog, new GenericRules(), {
  supports: {
    ntlmToggle: true,
    ntlmDomain: true,
    coreNtlmDomain: false,
    entryPath: true,
    rootEntryRedirect: true,
  },
});
