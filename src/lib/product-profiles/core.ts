import { createBaseProductProfile } from "./base";
import { buildCoreNtlmValidationUrl as buildCoreNtlmValidationUrlForCore } from "../core-ntlm";
import { CoreRules } from "../rules/core";
import { ProductCatalogEntry } from "../product-schema";

const coreCatalog: ProductCatalogEntry = {
  value: "core",
  label: "Core",
  icon: "CORE",
  desc: "Sistema Core bancario. Soporta NTLM Core, uploads y XHR largos.",
  tooltip: "Permite keepalive para XHR largos, proteccion para uploads multipart y reglas especiales de autenticacion Core.",
  defaults: {
    backgroundJobForMultipart: true,
    xhrKeepAliveForAjax: true,
  },
  contract: {
    forcesNtlm: false,
    supportsNtlmToggle: false,
    requiresCoreNtlmDomain: true,
    normalizesDynamicsCrmPath: false,
    rewritesDynamicsCrmClientConfig: false,
    keepsNtlmTransportPerRequest: false,
  },
};

export const coreProductProfile = createBaseProductProfile(coreCatalog, new CoreRules(), {
  supports: {
    ntlmToggle: false,
    ntlmDomain: false,
    coreNtlmDomain: true,
    entryPath: true,
    rootEntryRedirect: true,
  },
  buildCoreNtlmValidationUrl(connector) {
    return buildCoreNtlmValidationUrlForCore(connector);
  },
});
