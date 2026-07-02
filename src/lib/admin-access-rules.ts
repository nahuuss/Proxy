export function isLocalAdminHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return normalized.includes("localhost") || normalized.includes("127.0.0.1") || normalized.includes(":3000");
}

export function shouldBypassAdminAuth(input: {
  host: string;
  settingsBypass: boolean;
}): boolean {
  return input.settingsBypass || isLocalAdminHost(input.host);
}
