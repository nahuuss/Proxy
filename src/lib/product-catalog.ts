import type { Connector } from "./connectors";

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

export interface ProductCatalogEntry {
  value: ConnectorProductType;
  label: string;
  icon: string;
  desc: string;
  tooltip: string;
  defaults: ProductBehaviorConfig;
}

export const PRODUCT_CATALOG: readonly ProductCatalogEntry[] = [
  {
    value: "generic",
    label: "Genérico",
    icon: "🔗",
    desc: "Proxy HTTP/HTTPS estandar. Sin customizaciones especificas.",
    tooltip:
      "Solo activa el Heartbeat para navegaciones GET tradicionales. Sin reescrituras especiales ni soporte para uploads largos.",
    defaults: {},
  },
  {
    value: "dynamics-crm",
    label: "Dynamics CRM",
    icon: "📊",
    desc: "Microsoft Dynamics CRM on-premise. Habilita NTLM y reescrituras CRM.",
    tooltip:
      "Mantiene handshake NTLM por request, anti-lockout, reescritura CRM y comportamiento conservador de Heartbeat.",
    defaults: {},
  },
  {
    value: "core",
    label: "Core",
    icon: "🏦",
    desc: "Sistema Core bancario. Soporta NTLM Core, uploads y XHR largos.",
    tooltip:
      "Permite keepalive para XHR largos, proteccion para uploads multipart y reglas especiales de autenticacion Core.",
    defaults: {
      backgroundJobForMultipart: true,
      xhrKeepAliveForAjax: true,
    },
  },
  {
    value: "bank",
    label: "BANK",
    icon: "💳",
    desc: "Portal bancario. Corrige AJAX y protege cargas largas de cobranza.",
    tooltip:
      "Mantiene Heartbeat para GET largos y usa background jobs para UploadAndProcess y UploadAndProcessMutual.",
    defaults: {
      backgroundJobPaths: [
        "/cobranzaautomatica/uploadandprocess",
        "/cobranzaautomatica/uploadandprocessmutual",
      ],
      backgroundJobForMultipart: true,
    },
  },
  {
    value: "serena-test",
    label: "Serena Test",
    icon: "🧪",
    desc: "Entorno de staging y pruebas custom. Reglas DNN y exclusiones de login.",
    tooltip:
      "Excluye login y AJAX Delta, permite pruebas de uploads y mantiene limpieza DNN sin afectar produccion.",
    defaults: {
      backgroundJobForMultipart: true,
      xhrKeepAliveForAjax: true,
      loginPathHints: ["login", "ingreso"],
    },
  },
] as const;

export const DEFAULT_PRODUCT_TYPE: ConnectorProductType = "generic";

export function getProductCatalogEntry(productType?: string): ProductCatalogEntry {
  return (
    PRODUCT_CATALOG.find((entry) => entry.value === productType) ??
    PRODUCT_CATALOG.find((entry) => entry.value === DEFAULT_PRODUCT_TYPE)!
  );
}

export function normalizeConnectorProductType(productType?: string): ConnectorProductType {
  return getProductCatalogEntry(productType).value;
}

export function getEffectiveProductConfig(
  connectorLike: Pick<Connector, "connectorType" | "productConfig" | "hbForceUrls">,
): ProductBehaviorConfig {
  const productType = normalizeConnectorProductType(connectorLike.connectorType);
  const catalogDefaults = getProductCatalogEntry(productType).defaults;
  const currentConfig = connectorLike.productConfig?.[productType] ?? {};
  const mergedBackgroundJobPaths = Array.from(
    new Set([
      ...(catalogDefaults.backgroundJobPaths ?? []),
      ...(currentConfig.backgroundJobPaths ?? []),
      ...((connectorLike.hbForceUrls ?? []).map((path) => path.toLowerCase())),
    ]),
  );

  return {
    ...catalogDefaults,
    ...currentConfig,
    backgroundJobPaths: mergedBackgroundJobPaths,
    xhrKeepAlivePaths: Array.from(
      new Set([...(catalogDefaults.xhrKeepAlivePaths ?? []), ...(currentConfig.xhrKeepAlivePaths ?? [])]),
    ),
    passiveHtmlPaths: Array.from(
      new Set([...(catalogDefaults.passiveHtmlPaths ?? []), ...(currentConfig.passiveHtmlPaths ?? [])]),
    ),
    loginPathHints: Array.from(
      new Set([...(catalogDefaults.loginPathHints ?? []), ...(currentConfig.loginPathHints ?? [])]),
    ),
  };
}

export function buildDefaultProductConfig(productType?: string): ProductConfig {
  const normalizedType = normalizeConnectorProductType(productType);
  return {
    [normalizedType]: {
      ...getProductCatalogEntry(normalizedType).defaults,
    },
  };
}
