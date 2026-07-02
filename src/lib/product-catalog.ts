import type { Connector } from "./connectors";
import {
  ConnectorProductType,
  DEFAULT_PRODUCT_TYPE,
  ProductBehaviorConfig,
  ProductCatalogEntry,
  ProductConfig,
  ProductExecutionMode,
  ProductProfileContract,
} from "./product-schema";
import { getLegacyForcedExecutionPaths, getProductCatalogEntries, getProductProfile } from "./product-profiles";

export type {
  ConnectorProductType,
  ProductBehaviorConfig,
  ProductCatalogEntry,
  ProductConfig,
  ProductExecutionMode,
  ProductProfileContract,
};

export const PRODUCT_CATALOG: readonly ProductCatalogEntry[] = getProductCatalogEntries();
export { DEFAULT_PRODUCT_TYPE };

export function getProductCatalogEntry(productType?: string): ProductCatalogEntry {
  return getProductProfile(productType).catalog;
}

export function normalizeConnectorProductType(productType?: string): ConnectorProductType {
  return getProductCatalogEntry(productType).value;
}

export function getProductProfileContract(productType?: string): ProductProfileContract {
  return getProductCatalogEntry(productType).contract;
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
      ...getLegacyForcedExecutionPaths(connectorLike),
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
