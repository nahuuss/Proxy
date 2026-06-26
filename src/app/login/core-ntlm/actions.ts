"use server";

import { signIn } from "@/auth";

export async function coreNtlmSignIn(username: string, password: string, domain: string, connectorId: string) {
  try {
    await signIn("core-ntlm-login", { username, password, domain, connectorId, redirect: false });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Error" };
  }
}
