import fs from 'fs';
import path from 'path';
import http from 'http';

const MAX_BODY_CHAR_LIMIT = 2 * 1024 * 1024; // 2MB para evitar OOM e inflar el disco
const LOGS_DIR = path.join(process.cwd(), 'logs');

interface HarEntryParams {
  startTime: number;
  elapsedMs: number;
  req: http.IncomingMessage;
  reqBody?: string | Buffer | null;
  resStatusCode: number;
  resHeaders: Record<string, string | string[] | undefined>;
  resBody?: string | Buffer | null;
  overrideResBodySize?: number;
  username?: string;
}

/**
 * Parsea el header Cookie del Request a formato HAR
 */
function parseRequestCookies(cookieHeader?: string): Array<{ name: string; value: string }> {
  if (!cookieHeader) return [];
  return cookieHeader.split(';')
    .map(p => {
      const idx = p.indexOf('=');
      if (idx === -1) return null;
      return {
        name: p.slice(0, idx).trim(),
        value: p.slice(idx + 1).trim()
      };
    })
    .filter(Boolean) as Array<{ name: string; value: string }>;
}

/**
 * Parsea los headers Set-Cookie de la respuesta a formato HAR
 */
function parseResponseCookies(setCookieHeader?: string | string[]): Array<{ name: string; value: string }> {
  if (!setCookieHeader) return [];
  const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  return cookies.map(cookieStr => {
    const parts = cookieStr.split(';')[0];
    const idx = parts.indexOf('=');
    if (idx === -1) return null;
    return {
      name: parts.slice(0, idx).trim(),
      value: parts.slice(idx + 1).trim()
    };
  }).filter(Boolean) as Array<{ name: string; value: string }>;
}

/**
 * Parsea los headers HTTP a formato HAR
 */
function parseHeaders(headers: Record<string, string | string[] | undefined>): Array<{ name: string; value: string }> {
  const harHeaders: Array<{ name: string; value: string }> = [];
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      value.forEach(val => harHeaders.push({ name, value: val }));
    } else {
      harHeaders.push({ name, value });
    }
  }
  return harHeaders;
}

/**
 * Parsea el queryString de la URL a formato HAR
 */
function parseQueryString(urlStr: string): Array<{ name: string; value: string }> {
  try {
    const urlObj = new URL(urlStr, 'http://bizguard.local');
    const query: Array<{ name: string; value: string }> = [];
    urlObj.searchParams.forEach((value, name) => {
      query.push({ name, value });
    });
    return query;
  } catch {
    return [];
  }
}

/**
 * Loguea una entrada con formato compatible con HAR en un archivo .jsonl (NDJSON)
 */
export function logHarEntry(
  connectorId: string,
  harEnabled: boolean | undefined,
  params: HarEntryParams
) {
  if (!harEnabled) return;

  try {
    // Asegurar existencia del directorio de logs
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    }

    const harFile = path.join(LOGS_DIR, `har-${connectorId}.jsonl`);

    const { startTime, elapsedMs, req, reqBody, resStatusCode, resHeaders, resBody, overrideResBodySize, username } = params;

    const reqUrl = req.url || '';
    const reqHeaders = req.headers || {};
    
    // Calcular tamaño de cabeceras de request aproximadamente
    let reqHeadersSize = 0;
    for (const [k, v] of Object.entries(reqHeaders)) {
      reqHeadersSize += k.length + (v ? String(v).length : 0) + 4; // ": " y "\r\n"
    }

    // Calcular tamaño de cabeceras de response aproximadamente
    let resHeadersSize = 0;
    for (const [k, v] of Object.entries(resHeaders)) {
      resHeadersSize += k.length + (v ? String(v).length : 0) + 4;
    }

    // Formatear cuerpos de request y response
    let reqBodySize = 0;
    let reqPostData: any = undefined;
    if (reqBody) {
      reqBodySize = Buffer.isBuffer(reqBody) ? reqBody.length : Buffer.from(reqBody).length;
      const contentType = (reqHeaders['content-type'] || '') as string;
      const isText = /json|xml|urlencoded|text/i.test(contentType);

      if (isText && reqBodySize <= MAX_BODY_CHAR_LIMIT) {
        reqPostData = {
          mimeType: contentType,
          text: Buffer.isBuffer(reqBody) ? reqBody.toString('utf8') : reqBody
        };
      }
    }

    let resBodySize = 0;
    let resContent: any = {
      size: 0,
      mimeType: (resHeaders['content-type'] || 'application/octet-stream') as string
    };

    if (overrideResBodySize !== undefined) {
      resBodySize = overrideResBodySize;
      resContent.size = resBodySize;
    } else if (resBody) {
      resBodySize = Buffer.isBuffer(resBody) ? resBody.length : Buffer.from(resBody).length;
      resContent.size = resBodySize;

      const contentType = (resHeaders['content-type'] || '') as string;
      const isText = /json|javascript|css|html|xml|text/i.test(contentType) && !/\.(png|jpg|jpeg|gif|ico|cur|svg)$/i.test(reqUrl.split('?')[0]);

      if (isText && resBodySize <= MAX_BODY_CHAR_LIMIT) {
        resContent.text = Buffer.isBuffer(resBody) ? resBody.toString('utf8') : resBody;
      }
    }

    const entry = {
      startedDateTime: new Date(startTime).toISOString(),
      time: elapsedMs,
      _username: username || 'anonymous',
      request: {
        method: req.method || 'GET',
        url: reqUrl,
        httpVersion: 'HTTP/1.1',
        headers: parseHeaders(reqHeaders),
        queryString: parseQueryString(reqUrl),
        cookies: parseRequestCookies(reqHeaders.cookie),
        headersSize: reqHeadersSize,
        bodySize: reqBodySize,
        postData: reqPostData
      },
      response: {
        status: resStatusCode,
        statusText: http.STATUS_CODES[resStatusCode] || 'Unknown',
        httpVersion: 'HTTP/1.1',
        headers: parseHeaders(resHeaders),
        cookies: parseResponseCookies(resHeaders['set-cookie']),
        content: resContent,
        redirectURL: (resHeaders['location'] || '') as string,
        headersSize: resHeadersSize,
        bodySize: resBodySize
      },
      cache: {},
      timings: {
        send: 0,
        wait: elapsedMs,
        receive: 0
      }
    };

    const line = JSON.stringify(entry) + '\n';
    
    // Escritura asíncrona no bloqueante
    fs.appendFile(harFile, line, 'utf8', (err) => {
      if (err) {
        console.error(`[HAR-LOG-ERR] Error escribiendo en ${harFile}:`, err.message);
      }
    });

  } catch (error: any) {
    console.error(`[HAR-LOG-FATAL] Excepción en logHarEntry para ${connectorId}:`, error.message);
  }
}
