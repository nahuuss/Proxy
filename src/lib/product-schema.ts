export type ConnectorProductType = "generic" | "dynamics-crm" | "core" | "bank" | "serena-test";

export type ProductExecutionMode =
  | "none"
  | "passive-html"
  | "xhr-keepalive"
  | "background-job";

export interface ProductBehaviorConfig {
  backgroundJobPaths?: string[];
  xhrKeepAlivePaths?: string[];
  passiveHtmlPaths?: string[];
  loginPathHints?: string[];
  backgroundJobForMultipart?: boolean;
  xhrKeepAliveForAjax?: boolean;
}

export type ProductConfig = Partial<Record<ConnectorProductType, ProductBehaviorConfig>>;

export interface ProductProfileContract {
  forcesNtlm: boolean;
  supportsNtlmToggle: boolean;
  requiresCoreNtlmDomain: boolean;
  normalizesDynamicsCrmPath: boolean;
  rewritesDynamicsCrmClientConfig: boolean;
  keepsNtlmTransportPerRequest: boolean;
}

export interface ProductCatalogEntry {
  value: ConnectorProductType;
  label: string;
  icon: string;
  desc: string;
  tooltip: string;
  defaults: ProductBehaviorConfig;
  contract: ProductProfileContract;
}

export const DEFAULT_PRODUCT_TYPE: ConnectorProductType = "generic";
