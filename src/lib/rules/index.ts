import { ConnectorRules } from "./base";
import { ConnectorProductType, DEFAULT_PRODUCT_TYPE } from "../product-schema";
import { getProductProfile } from "../product-profiles";

export function getRulesFor(connectorType?: string): ConnectorRules {
  return getProductProfile(connectorType).rules;
}

export function getDefaultConnectorType(): ConnectorProductType {
  return DEFAULT_PRODUCT_TYPE;
}

export * from "./base";
