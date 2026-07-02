import {
  buildDefaultProductConfig,
  normalizeConnectorProductType,
  type ConnectorProductType,
  type ProductConfig,
} from './product-catalog';
import { normalizeConnectorWithProfile } from './product-profiles';

import type { Connector } from './connectors';

export function normalizeProductConfig(
  productConfig: ProductConfig | undefined,
  connectorType: ConnectorProductType,
): ProductConfig {
  const defaults = buildDefaultProductConfig(connectorType);
  return {
    [connectorType]: {
      ...defaults[connectorType],
      ...(productConfig?.[connectorType] || {}),
    },
  };
}

export function normalizeConnector(connector: Connector): Connector {
  const profileNormalized = normalizeConnectorWithProfile(connector);
  const connectorType = normalizeConnectorProductType(profileNormalized.connectorType);
  return {
    ...profileNormalized,
    connectorType,
    productConfig: normalizeProductConfig(profileNormalized.productConfig, connectorType),
  };
}
