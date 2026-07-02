import { createBaseProductProfile } from "./base";
import { SerenaTestRules } from "../rules/serena-test";
import { ProductCatalogEntry } from "../product-schema";

const serenaTestCatalog: ProductCatalogEntry = {
  value: "serena-test",
  label: "Serena Test",
  icon: "TEST",
  desc: "Entorno de staging y pruebas custom. Reglas DNN y exclusiones de login.",
  tooltip: "Excluye login y AJAX Delta, permite pruebas de uploads y mantiene limpieza DNN sin afectar produccion.",
  defaults: {
    backgroundJobForMultipart: true,
    xhrKeepAliveForAjax: true,
    loginPathHints: ["login", "ingreso"],
  },
  contract: {
    forcesNtlm: false,
    supportsNtlmToggle: true,
    requiresCoreNtlmDomain: false,
    normalizesDynamicsCrmPath: false,
    rewritesDynamicsCrmClientConfig: false,
    keepsNtlmTransportPerRequest: false,
  },
};

export const serenaTestProductProfile = createBaseProductProfile(serenaTestCatalog, new SerenaTestRules(), {
  supports: {
    ntlmToggle: true,
    ntlmDomain: true,
    coreNtlmDomain: false,
    entryPath: true,
    rootEntryRedirect: true,
  },
});
