"use server";

import { signIn } from "@/auth";

export async function ntlmSignIn(username: string, password: string, domain: string) {
  try {
    await signIn("ntlm-login", { username, password, domain, redirect: false });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Error" };
  }
}
