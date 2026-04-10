"use server"

import { addConnector, updateConnector, getConnectorById, deleteConnector } from "@/lib/connectors";
import { revalidatePath } from "next/cache";
import { proxyManager } from "@/lib/proxy-manager";

export async function createConnectorAction(prevState: any, formData: FormData) {
  try {
    const name = formData.get("name") as string;
    const description = formData.get("description") as string || "";
    const targetUrl = formData.get("targetUrl") as string;
    const publicHost = formData.get("publicHost") as string;
    const port = parseInt(formData.get("port") as string);
    const id = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    const newConnector = await addConnector({ id, name, description, targetUrl, publicHost, port });
    
    // Levantar el puerto inmediatamente
    proxyManager.startConnector(newConnector);
    
    revalidatePath("/");
    return { success: true, message: "Node provisioned successfully" };
  } catch (e: any) {
    return { success: false, message: e.message || "Failed to provision node" };
  }
}

export async function updateConnectorAction(id: string, formData: FormData) {
  const name = formData.get("name") as string;
  const description = formData.get("description") as string || "";
  const targetUrl = formData.get("targetUrl") as string;
  const publicHost = formData.get("publicHost") as string;
  const port = parseInt(formData.get("port") as string);
  const bypassAuth = formData.get("bypassAuth") === "on";
  const connectorType = (formData.get("connectorType") as string || "generic") as 'generic' | 'dynamics-crm' | 'core' | 'bank';
  // Para dynamics-crm, isNtlm siempre true aunque el hidden field diga "on"
  const isNtlm = connectorType === 'dynamics-crm' || formData.get("isNtlm") === "on";
  const ntlmDomain = (formData.get("ntlmDomain") as string || "").trim() || undefined;
  const entryPath = (formData.get("entryPath") as string || "").trim() || undefined;

  const updated = await updateConnector(id, { name, description, targetUrl, publicHost, port, bypassAuth, connectorType, isNtlm, ntlmDomain, entryPath });
  
  if (updated) {
    // Reiniciar el conector con la nueva configuración
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
  
  const newState = !current.isActive;
  const updated = await updateConnector(id, { isActive: newState });
  
  if (updated) {
    proxyManager.startConnector(updated);
  }
  
  revalidatePath("/");
}
