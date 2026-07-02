"use server"

import { addConnector, updateConnector, getConnectorById, deleteConnector, getConnectors } from "@/lib/connectors";
import { revalidatePath } from "next/cache";
import { proxyManager } from "@/lib/proxy-manager";
import { getSettings, updateSettings } from "@/lib/settings";
import { getAdminAccessState } from "@/lib/admin-access";
import { parseConnectorDraftFromFormData } from "@/lib/connector-draft";
import { prepareConnectorForCreate, prepareConnectorForUpdate } from "@/lib/connector-admin";
import { checkSystemPortAvailability, isPortConfigured } from "@/lib/port-check";
import {
  buildGlobalSettingsUpdate,
  canUpdateGlobalSettings,
  parseGlobalSettingsFormData,
  validateGlobalSettingsFormInput,
} from "@/lib/settings-admin";

export async function createConnectorAction(prevState: any, formData: FormData) {
  try {
    const draft = parseConnectorDraftFromFormData(formData);
    const { connector, validationErrors } = prepareConnectorForCreate(draft);
    if (validationErrors.length > 0) {
      return { success: false, message: validationErrors.join(" ") };
    }

    const newConnector = await addConnector(connector as Parameters<typeof addConnector>[0]);
    proxyManager.startConnector(newConnector);

    revalidatePath("/");
    return { success: true, message: "Node provisioned successfully" };
  } catch (e: any) {
    return { success: false, message: e.message || "Failed to provision node" };
  }
}

export async function updateConnectorAction(id: string, formData: FormData) {
  const draft = parseConnectorDraftFromFormData(formData);
  const { connector, validationErrors } = prepareConnectorForUpdate(draft);
  if (validationErrors.length > 0) {
    throw new Error(validationErrors.join(" "));
  }

  const updated = await updateConnector(id, connector);

  if (updated) {
    proxyManager.startConnector(updated);
  }

  revalidatePath("/");
}

export async function deleteConnectorAction(id: string) {
  await deleteConnector(id);
  proxyManager.stopConnector(id);
  revalidatePath("/");
}

export async function toggleConnectorAction(id: string) {
  const current = await getConnectorById(id);
  if (!current) return;

  const updated = await updateConnector(id, { isActive: !current.isActive });

  if (updated) {
    proxyManager.startConnector(updated);
  }

  revalidatePath("/");
}

export async function checkPortAction(port: number): Promise<{ occupied: boolean; reason?: "configured" | "system" }> {
  try {
    const connectors = await getConnectors();
    if (isPortConfigured(connectors, port)) {
      return { occupied: true, reason: "configured" };
    }

    return await checkSystemPortAvailability(port);
  } catch {
    return { occupied: true, reason: "system" };
  }
}

export async function updateGlobalSettingsAction(prevState: any, formData: FormData) {
  const currentSettings = await getSettings();
  const access = await getAdminAccessState();

  if (!canUpdateGlobalSettings({ settingsBypass: currentSettings.bypassAuth, hasAdminAccess: access.hasAccess })) {
    return { success: false, message: "Sesion no valida para actualizar configuracion." };
  }

  const settingsInput = parseGlobalSettingsFormData(formData);
  const validationErrors = validateGlobalSettingsFormInput(settingsInput);
  if (validationErrors.length > 0) {
    return { success: false, message: validationErrors.join(" ") };
  }

  await updateSettings(buildGlobalSettingsUpdate(settingsInput));

  revalidatePath("/");
  return { success: true, message: "Configuracion global actualizada." };
}
