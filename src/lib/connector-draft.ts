import {
  ConnectorProductType,
  DEFAULT_PRODUCT_TYPE,
  normalizeConnectorProductType,
} from "./product-catalog";

export interface ConnectorDraftInput {
  name: string;
  description: string;
  targetUrl: string;
  publicHost: string;
  port: number;
  bypassAuth: boolean;
  connectorType: ConnectorProductType;
  isNtlm: boolean;
  ntlmDomain?: string;
  coreNtlmDomain?: string;
  entryPath?: string;
  harLog: boolean;
  trafficLog: boolean;
  ssoLog: boolean;
  hbLog: boolean;
  hbFirstPulse?: number;
  trafficRetentionValue?: number;
  trafficRetentionUnit: "seconds" | "minutes" | "hours" | "days";
}

function getFormBooleanValue(formData: FormData, fieldName: string): boolean {
  const rawValue = formData.get(fieldName);
  if (rawValue === null) return false;
  const normalized = String(rawValue).trim().toLowerCase();
  return normalized === "true" || normalized === "on" || normalized === "1" || normalized === "yes";
}

function getOptionalTrimmedValue(formData: FormData, fieldName: string): string | undefined {
  return (formData.get(fieldName) as string || "").trim() || undefined;
}

function getOptionalNumberValue(formData: FormData, fieldName: string): number | undefined {
  const rawValue = (formData.get(fieldName) as string || "").trim();
  if (!rawValue) return undefined;
  const parsed = parseInt(rawValue, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseConnectorDraftFromFormData(formData: FormData): ConnectorDraftInput {
  return {
    name: (formData.get("name") as string || "").trim(),
    description: (formData.get("description") as string || "").trim(),
    targetUrl: (formData.get("targetUrl") as string || "").trim(),
    publicHost: (formData.get("publicHost") as string || "").trim(),
    port: parseInt((formData.get("port") as string || "").trim(), 10),
    bypassAuth: getFormBooleanValue(formData, "bypassAuth"),
    connectorType: normalizeConnectorProductType(
      (formData.get("connectorType") as string) || DEFAULT_PRODUCT_TYPE,
    ),
    isNtlm: getFormBooleanValue(formData, "isNtlm"),
    ntlmDomain: getOptionalTrimmedValue(formData, "ntlmDomain"),
    coreNtlmDomain: getOptionalTrimmedValue(formData, "coreNtlmDomain"),
    entryPath: getOptionalTrimmedValue(formData, "entryPath"),
    harLog: getFormBooleanValue(formData, "harLog"),
    trafficLog: getFormBooleanValue(formData, "trafficLog"),
    ssoLog: getFormBooleanValue(formData, "ssoLog"),
    hbLog: getFormBooleanValue(formData, "hbLog"),
    hbFirstPulse: getOptionalNumberValue(formData, "hbFirstPulse"),
    trafficRetentionValue: getOptionalNumberValue(formData, "trafficRetentionValue"),
    trafficRetentionUnit: ((formData.get("trafficRetentionUnit") as string) || "hours") as "seconds" | "minutes" | "hours" | "days",
  };
}
