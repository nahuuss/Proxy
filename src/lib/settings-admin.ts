import type { GlobalSettings } from "./settings";

export interface GlobalSettingsFormInput {
  publicHost: string;
  authUrl: string;
  internalTarget: string;
  hbFirstPulse: number;
  bypassAuth: boolean;
  memoryResetIntervalMinutes: number;
}

function getFormBooleanValue(formData: FormData, fieldName: string): boolean {
  const rawValue = formData.get(fieldName);
  if (rawValue === null) return false;
  const normalized = String(rawValue).trim().toLowerCase();
  return normalized === "true" || normalized === "on" || normalized === "1" || normalized === "yes";
}

function parsePositiveInteger(rawValue: string, defaultValue: number): number {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return defaultValue;
  }

  const parsed = parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function canUpdateGlobalSettings(input: {
  settingsBypass: boolean;
  hasAdminAccess: boolean;
}): boolean {
  return input.settingsBypass || input.hasAdminAccess;
}

export function parseGlobalSettingsFormData(formData: FormData): GlobalSettingsFormInput {
  return {
    publicHost: (formData.get("publicHost") as string || "").trim(),
    authUrl: (formData.get("authUrl") as string || "").trim(),
    internalTarget: (formData.get("internalTarget") as string || "").trim(),
    hbFirstPulse: parsePositiveInteger((formData.get("hbFirstPulse") as string || ""), 20),
    bypassAuth: getFormBooleanValue(formData, "bypassAuth"),
    memoryResetIntervalMinutes: parsePositiveInteger((formData.get("memoryResetIntervalMinutes") as string || ""), 30),
  };
}

export function validateGlobalSettingsFormInput(input: GlobalSettingsFormInput): string[] {
  const errors: string[] = [];

  if (!Number.isFinite(input.hbFirstPulse) || input.hbFirstPulse <= 0) {
    errors.push("El tiempo de HB Shield debe ser mayor a 0.");
  }

  if (!Number.isFinite(input.memoryResetIntervalMinutes) || input.memoryResetIntervalMinutes <= 0) {
    errors.push("El tiempo de reset automatico debe ser mayor a 0.");
  }

  return errors;
}

export function buildGlobalSettingsUpdate(input: GlobalSettingsFormInput): Partial<Omit<GlobalSettings, "id">> {
  return {
    publicHost: input.publicHost,
    authUrl: input.authUrl,
    internalTarget: input.internalTarget,
    hbFirstPulse: input.hbFirstPulse,
    bypassAuth: input.bypassAuth,
    memoryResetIntervalMinutes: input.memoryResetIntervalMinutes,
  };
}
