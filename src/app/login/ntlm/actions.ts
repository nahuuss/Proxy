"use server";

import { signIn } from "@/auth";
import { CRM_NTLM_PROVIDER_ID } from "@/lib/auth-ntlm";

export async function ntlmSignIn(username: string, password: string, domain: string, connectorId: string) {
  try {
    await signIn(CRM_NTLM_PROVIDER_ID, { username, password, domain, connectorId, redirect: false });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Error" };
  }
}
