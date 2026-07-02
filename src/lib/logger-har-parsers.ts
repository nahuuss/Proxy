export function parseHarRequestCookies(cookieHeader?: string): Array<{ name: string; value: string }> {
  if (!cookieHeader) return [];
  return cookieHeader
    .split(";")
    .map((part) => {
      const idx = part.indexOf("=");
      if (idx === -1) return null;
      return {
        name: part.slice(0, idx).trim(),
        value: part.slice(idx + 1).trim(),
      };
    })
    .filter(Boolean) as Array<{ name: string; value: string }>;
}

export function parseHarResponseCookies(
  setCookieHeader?: string | string[],
): Array<{ name: string; value: string }> {
  if (!setCookieHeader) return [];
  const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  return cookies
    .map((cookie) => {
      const firstPart = cookie.split(";")[0];
      const idx = firstPart.indexOf("=");
      if (idx === -1) return null;
      return {
        name: firstPart.slice(0, idx).trim(),
        value: firstPart.slice(idx + 1).trim(),
      };
    })
    .filter(Boolean) as Array<{ name: string; value: string }>;
}

export function parseHarHeaders(
  headers: Record<string, string | string[] | undefined>,
): Array<{ name: string; value: string }> {
  const result: Array<{ name: string; value: string }> = [];
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      value.forEach((entry) => result.push({ name, value: entry }));
    } else {
      result.push({ name, value });
    }
  }
  return result;
}

export function parseHarQueryString(urlStr: string): Array<{ name: string; value: string }> {
  try {
    const url = new URL(urlStr, "http://bizguard.local");
    const query: Array<{ name: string; value: string }> = [];
    url.searchParams.forEach((value, name) => {
      query.push({ name, value });
    });
    return query;
  } catch {
    return [];
  }
}
