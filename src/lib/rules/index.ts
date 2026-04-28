import { ConnectorRules } from "./base";
import { CoreRules } from "./core";
import { BankRules } from "./bank";
import { GenericRules, CrmRules } from "./generic";

export function getRulesFor(connectorType?: string): ConnectorRules {
  switch (connectorType) {
    case 'core':
      return new CoreRules();
    case 'bank':
      return new BankRules();
    case 'dynamics-crm':
      return new CrmRules();
    default:
      return new GenericRules();
  }
}

export * from "./base";
