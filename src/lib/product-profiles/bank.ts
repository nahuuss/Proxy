import { createBaseProductProfile } from "./base";
import { BankRules } from "../rules/bank";
import { ProductCatalogEntry } from "../product-schema";

const bankCatalog: ProductCatalogEntry = {
  value: "bank",
  label: "BANK",
  icon: "BANK",
  desc: "Portal bancario. Corrige AJAX y protege cargas largas de cobranza.",
  tooltip: "Mantiene Heartbeat para GET largos y usa background jobs para UploadAndProcess y UploadAndProcessMutual.",
  defaults: {
    backgroundJobPaths: [
      "/cobranzaautomatica/uploadandprocess",
      "/cobranzaautomatica/uploadandprocessmutual",
    ],
    backgroundJobForMultipart: true,
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

export const bankProductProfile = createBaseProductProfile(bankCatalog, new BankRules(), {
  supports: {
    ntlmToggle: true,
    ntlmDomain: true,
    coreNtlmDomain: false,
    entryPath: true,
    rootEntryRedirect: true,
  },
});
