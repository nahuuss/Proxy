import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AutoLoginClient } from "@/components/AutoLoginClient";
import { getConnectors } from "@/lib/connectors";
import { logSSO } from "@/lib/logger-sso";
import { resolveLoginEntry } from "@/lib/login-entry";
import { getSettings } from "@/lib/settings";

function readFirst(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const callbackUrl = readFirst(resolvedSearchParams.callbackUrl);
  const headersList = await headers();
  const connectors = await getConnectors();
  const settings = await getSettings();
  const resolution = resolveLoginEntry({
    callbackUrl,
    forwardedHost: headersList.get("x-forwarded-host"),
    requestHost: headersList.get("host"),
    forwardedProto: headersList.get("x-forwarded-proto"),
    connectors,
    settings,
    fallbackAuthUrl: process.env.AUTH_URL,
  });

  logSSO(
    resolution.matchedConnector?.id,
    `[LOGIN-PAGE] callbackRaw=${callbackUrl || "(empty)"} callbackEffective=${resolution.effectiveCallbackUrl} bypass=${resolution.shouldBypassSso} reason=${resolution.reason}`,
  );

  if (resolution.shouldBypassSso) {
    redirect(resolution.bypassRedirectUrl);
  }

  return (
    <Suspense fallback={<div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>Cargando...</div>}>
      <AutoLoginClient callbackUrl={resolution.effectiveCallbackUrl} />
    </Suspense>
  );
}
