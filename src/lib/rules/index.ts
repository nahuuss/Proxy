import { ConnectorRules } from "./base";
import { ConnectorProductType, DEFAULT_PRODUCT_TYPE, normalizeConnectorProductType } from "../product-catalog";
import { CoreRules } from "./core";
import { BankRules } from "./bank";
import { SerenaTestRules } from "./serena-test";
import { GenericRules, CrmRules } from "./generic";

export function getRulesFor(connectorType?: string): ConnectorRules {
  switch (normalizeConnectorProductType(connectorType)) {
    case 'core':
      return new CoreRules();
    case 'bank':
      return new BankRules();
    case 'serena-test':
      return new SerenaTestRules();
    case 'dynamics-crm':
      return new CrmRules();
    default:
      return new GenericRules();
  }
}

export function getDefaultConnectorType(): ConnectorProductType {
  return DEFAULT_PRODUCT_TYPE;
}

export * from "./base";
