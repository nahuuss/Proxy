import type { Connector } from "./connectors";
import { type ConnectorDraftInput } from "./connector-draft";
import { buildDefaultProductConfig } from "./product-catalog";
import { normalizeConnectorWithProfile, validateConnectorWithProfile } from "./product-profiles";

export interface ConnectorPreparationResult {
  connector: Partial<Connector>;
  validationErrors: string[];
}

export function buildConnectorId(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export function prepareConnectorForCreate(draft: ConnectorDraftInput): ConnectorPreparationResult {
  const connector = normalizeConnectorWithProfile({
    id: buildConnectorId(draft.name),
    ...draft,
    productConfig: buildDefaultProductConfig(draft.connectorType),
  });

  return {
    connector,
    validationErrors: validateConnectorWithProfile(connector),
  };
}

export function prepareConnectorForUpdate(draft: ConnectorDraftInput): ConnectorPreparationResult {
  const connector = normalizeConnectorWithProfile({
    ...draft,
  });

  return {
    connector,
    validationErrors: validateConnectorWithProfile(connector),
  };
}
