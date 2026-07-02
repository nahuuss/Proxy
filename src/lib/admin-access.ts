import { auth } from "@/auth";
import { headers } from "next/headers";
import type { Session } from "next-auth";
import { getSettings } from "./settings";
import { shouldBypassAdminAuth } from "./admin-access-rules";

export interface AdminAccessState {
  host: string;
  isBypass: boolean;
  hasSession: boolean;
  hasAccess: boolean;
  session: Session | null;
}

export async function getAdminAccessState(): Promise<AdminAccessState> {
  const settings = await getSettings();
  const headersList = await headers();
  const host = headersList.get("host") || "";
  const isBypass = shouldBypassAdminAuth({
    host,
    settingsBypass: settings.bypassAuth,
  });
  const session = isBypass ? null : await auth();

  return {
    host,
    isBypass,
    hasSession: !!session?.user,
    hasAccess: isBypass || !!session?.user,
    session,
  };
}
