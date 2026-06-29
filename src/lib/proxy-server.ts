import http from "http";
import https from "https";
import crypto from "crypto";
import httpntlm from "httpntlm";
import zlib from "zlib";
import { EventEmitter } from "events";
import { Connector } from "./connectors";
import { logHB as rawLogHB } from "./logger-hb";
import { logHarEntry } from "./logger-har";
import { logSSO } from "./logger-sso";
import { trafficLogger, extractCookieNames, TrafficEntry, DebugEntry } from "./logger-traffic";
import { applyDeepRewrite, serveAsBlobDownload, renderBgJobPage, rewriteHeaders } from "./proxy-utils";
import { getRulesFor } from "./rules";
import { buildCoreNtlmValidationUrl, hasCoreNtlmSessionForConnector, isCoreNtlmPath } from "./core-ntlm";
import { normalizeDynamicsCrmProxyPath, rewriteDynamicsCrmClientConfig } from "./dynamics-crm";
import { deleteBgJob, getBgJob, setBgJob, startBgJobCleanup, updateBgJob } from "./background-job-store";
import { getEffectiveProductConfig, ProductExecutionMode } from "./product-catalog";
import { classifyRequest } from "./request-classifier";

export type MetricCallback = (id: string, bytes: number, latency?: number) => void;

// Configuración Heartbeat Shield (anti Cloudflare 524)
const DEFAULT_HB_FIRST_PULSE_MS = 20000;  // 20s = umbral de activación por defecto
const HB_INTERVAL_MS = 15000;     // Intervalo de keepalive (TCP o body spaces para full-page nav)
// Para XHR/AJAX, el HB usa TCP keepalive en lugar de escribir espacios al body HTTP.
// Escribir espacios al body de un XHR rompe el JSON que el cliente intenta parsear.

// Límite de tamaño de body en requests entrantes (protección contra OOM).
const MAX_BODY_BYTES = parseInt(process.env.MAX_REQUEST_BODY_MB || '500') * 1024 * 1024;

function normalizeHeartbeatPathCandidate(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function matchesForcedHeartbeatPath(urlPart: string, forcedUrls?: string[]): boolean {
  if (!forcedUrls || forcedUrls.length === 0) return false;
  const normalizedPath = normalizeHeartbeatPathCandidate(urlPart);
  return forcedUrls
    .map(normalizeHeartbeatPathCandidate)
    .filter(Boolean)
    .some(candidate =>
      normalizedPath === candidate ||
      normalizedPath.startsWith(`${candidate}?`) ||
      normalizedPath.startsWith(candidate)
    );
}

function emitInterimProcessingPulse(res: http.ServerResponse): boolean {
  if (res.headersSent || res.writableEnded || res.destroyed) return false;
  const writer = (res as any).writeProcessing;
  if (typeof writer !== "function") return false;
  writer.call(res);
  return true;
}

// ─── Background Job Store ────────────────────────────────────────────────────
startBgJobCleanup(30 * 60 * 1000, 10 * 60 * 1000);

interface CrmNtlmCircuitState {
  failures: number[];
  blockedUntil: number;
}

const CRM_NTLM_FAIL_WINDOW_MS = 60_000;
const CRM_NTLM_FAIL_THRESHOLD = 5;
const CRM_NTLM_BLOCK_MS = 3 * 60_000;
const crmNtlmCircuit = new Map<string, CrmNtlmCircuitState>();

function getCrmNtlmCircuitKey(connectorId: string, username: string) {
  return `${connectorId}:${username}`.toLowerCase();
}

function pruneCrmNtlmFailures(now: number, state?: CrmNtlmCircuitState) {
  if (!state) return;
  state.failures = state.failures.filter(ts => now - ts <= CRM_NTLM_FAIL_WINDOW_MS);
  if (state.blockedUntil && state.blockedUntil <= now) {
    state.blockedUntil = 0;
  }
}

function isCrmNtlmNoisePath(path: string) {
  return path.toLowerCase().startsWith("/.well-known/appspecific/");
}

function buildCrmNtlmHeaders(headers: http.IncomingHttpHeaders, bodyLength: number) {
  const allowedHeaderNames = new Set([
    'accept',
    'accept-language',
    'cache-control',
    'content-type',
    'if-match',
    'if-none-match',
    'origin',
    'pragma',
    'referer',
    'soapaction',
    'user-agent',
    'x-requested-with',
  ]);

  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers || {})) {
    const normalizedKey = key.toLowerCase();
    if (!allowedHeaderNames.has(normalizedKey)) continue;
    if (typeof value === 'string') sanitized[normalizedKey] = value;
    else if (Array.isArray(value)) sanitized[normalizedKey] = value.join(', ');
  }

  if (bodyLength > 0) {
    sanitized['content-length'] = String(bodyLength);
  }

  return sanitized;
}

function getCrmNtlmBlockState(connector: Connector, username: string) {
  const key = getCrmNtlmCircuitKey(connector.id, username);
  const state = crmNtlmCircuit.get(key);
  const now = Date.now();
  pruneCrmNtlmFailures(now, state);
  if (!state || !state.blockedUntil || state.blockedUntil <= now) {
    if (state) crmNtlmCircuit.set(key, state);
    return null;
  }
  crmNtlmCircuit.set(key, state);
  return state;
}

function recordCrmNtlmFailure(connector: Connector, username: string, path: string, statusCode: number) {
  if (isCrmNtlmNoisePath(path)) return;
  const now = Date.now();
  const key = getCrmNtlmCircuitKey(connector.id, username);
  const state = crmNtlmCircuit.get(key) || { failures: [], blockedUntil: 0 };
  pruneCrmNtlmFailures(now, state);
  state.failures.push(now);
  const count = state.failures.length;

  if (count === 1) {
    logSSO(connector.id, `[CRM-NTLM-401] Primer 401 para usuario=${username} path=${path}`);
  } else {
    logSSO(connector.id, `[CRM-NTLM-401] status=${statusCode} acumulado=${count} usuario=${username} path=${path}`);
  }

  if (count >= CRM_NTLM_FAIL_THRESHOLD) {
    state.blockedUntil = now + CRM_NTLM_BLOCK_MS;
    logSSO(connector.id, `[CRM-NTLM-BREAKER] Apertura por ${count} fallos NTLM para usuario=${username} path=${path} hasta=${new Date(state.blockedUntil).toISOString()}`);
  }

  crmNtlmCircuit.set(key, state);
}

function resetCrmNtlmFailureState(connector: Connector, username: string) {
  const key = getCrmNtlmCircuitKey(connector.id, username);
  const state = crmNtlmCircuit.get(key);
  if (!state) return;
  crmNtlmCircuit.delete(key);
  if (state.failures.length > 0 || state.blockedUntil > 0) {
    logSSO(connector.id, `[CRM-NTLM-BREAKER] Cierre y reset por respuesta exitosa para usuario=${username}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export function createProxyServer(connector: Connector, onMetric: MetricCallback, hbFirstPulseMs: number) {
  const logHB = (message: string) => rawLogHB(connector.id, message);
  const targetUrl = new URL(connector.targetUrl);
  const isHttps = targetUrl.protocol === "https:";
  const statusEvents = new EventEmitter();
  statusEvents.setMaxListeners(200);
  const agent = isHttps
    ? new https.Agent({ keepAlive: true, rejectUnauthorized: connector.strictTls === true })
    : new http.Agent({ keepAlive: true });

  const server = http.createServer((req, res) => {
    const startTime = Date.now();
    const emitStatus = (event: Record<string, unknown>) => {
      statusEvents.emit("status", {
        connectorId: connector.id,
        at: Date.now(),
        ...event,
      });
    };

    // ── Background Job API (/__bizguard_job/{id}/status|result) ──────────────
    const rawUrlPath = (req.url || '').split('?')[0].toLowerCase();
    if (rawUrlPath === '/__bizguard_status/stream') {
      let streamClientId = "";
      try {
        const statusUrl = new URL(req.url || '/', 'http://bizguard.local');
        streamClientId = (statusUrl.searchParams.get('clientId') || '').slice(0, 80);
      } catch {}

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });
      res.write(': open\n\n');

      const onStatus = (event: Record<string, unknown>) => {
        if (streamClientId && event.clientId && event.clientId !== streamClientId) return;
        if (!res.destroyed) {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        }
      };
      const heartbeat = setInterval(() => {
        if (!res.destroyed) res.write(': heartbeat\n\n');
      }, 15000);

      statusEvents.on("status", onStatus);

      let cleaned = false;
      const cleanupSSE = () => {
        if (cleaned) return;
        cleaned = true;
        clearInterval(heartbeat);
        statusEvents.off("status", onStatus);
      };

      req.on('close', cleanupSSE);
      req.on('aborted', cleanupSSE);
      res.on('close', cleanupSSE);
      res.on('finish', cleanupSSE);
      return;
    }

    if (rawUrlPath.startsWith('/__bizguard_job/')) {
      const parts = rawUrlPath.replace('/__bizguard_job/', '').split('/');
      const jobId = parts[0];
      const action = parts[1] || 'status';
      const job = getBgJob(jobId);
      if (!job) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Job no encontrado o expirado' }));
        return;
      }
      if (action === 'status') {
        const elapsed = Math.round((Date.now() - job.startedAt) / 1000);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: job.status, elapsed, error: job.error || null }));
        return;
      }
      if (action === 'result') {
        if (job.status !== 'done' || !job.responseBody) {
          res.writeHead(202, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: job.status }));
          return;
        }
        const safeHdrs: Record<string, string | string[]> = {};
        for (const h of ['content-type', 'content-disposition', 'cache-control', 'location', 'set-cookie']) {
          const val = job.responseHeaders?.[h];
          if (val) safeHdrs[h] = val as string | string[];
        }
        safeHdrs['content-length'] = String(job.responseBody.length);
        res.writeHead(job.statusCode || 200, safeHdrs);
        res.end(job.responseBody);
        
        // Liberar inmediatamente el buffer de la memoria eliminando el trabajo del mapa
        deleteBgJob(jobId);
        return;
      }
      res.writeHead(404); res.end();
      return;
    }

    const headers = { ...req.headers };
    const bizguardClientId = String(headers['x-bizguard-client-id'] || '').slice(0, 80);
    const bizguardRequestId = String(headers['x-bizguard-request-id'] || '').slice(0, 80);
    Object.keys(headers).forEach(h => {
      if (h.startsWith('cf-') || h.startsWith('x-forwarded-')) delete headers[h];
    });
    delete headers['x-bizguard-client-id'];
    delete headers['x-bizguard-request-id'];

    const incomingHost = req.headers.host || connector.publicHost;
    const isInternalAuth = connector.id === "internal-dashboard";
    const hostToSend = isInternalAuth ? incomingHost : targetUrl.host;
    const proto = (incomingHost.includes("localhost") || incomingHost.includes("127.0.0.1")) ? "http" : "https";
    const effectiveReqUrl = connector.connectorType === "dynamics-crm"
      ? normalizeDynamicsCrmProxyPath(req.url || "/", connector.entryPath)
      : (req.url || "/");

    const options: http.RequestOptions = {
      hostname: targetUrl.hostname,
      port: targetUrl.port || (isHttps ? 443 : 80),
      path: effectiveReqUrl,
      method: req.method,
      headers: {
        ...headers,
        "host": hostToSend,
        "x-forwarded-host": incomingHost,
        "x-forwarded-proto": proto,
        "x-forwarded-for": req.headers['x-forwarded-for'] || req.socket.remoteAddress || "127.0.0.1",
        "x-real-ip": req.headers['x-real-ip'] || req.socket.remoteAddress || "127.0.0.1",
        "accept-encoding": "identity", // Preferimos identity para reescritura fácil
      },
      agent,
    };

    let jobId: string | null = null;
    let isHeartbeatActive = false;
    let isHtmlCommentOpen = false;
    let hbTimer: NodeJS.Timeout | null = null;
    let hbInterval: NodeJS.Timeout | null = null;
    let hbStart: number | null = null;
    let heartbeatEndEmitted = false;

    const urlPart = effectiveReqUrl.split('?')[0].toLowerCase();
    const path = effectiveReqUrl.split('?')[0];
    const rules = getRulesFor(connector.connectorType);
    const productConfig = getEffectiveProductConfig(connector);
    const isInternalConnector = connector.id === "internal-dashboard";
    const requestShape = classifyRequest(req, urlPart);
    const { isImage, isStatic, isPostLike, isAjax, isMultipartUpload } = requestShape;
    const hasForcedHeartbeatPath = matchesForcedHeartbeatPath(urlPart, connector.hbForceUrls);
    const executionMode: ProductExecutionMode = isInternalConnector
      ? "none"
      : rules.resolveExecutionMode({
          req,
          connector,
          urlPart,
          path,
          isStatic,
          isImage,
          isPostLike,
          isAjax,
          isMultipartUpload,
          hasForcedHeartbeatPath,
          productConfig,
        });
    const hbEligible = executionMode !== "none";

    // Helper para loguear eventos de debug en el traffic log unificado
    const logDebugEntry = (tag: string, extra?: string, status?: number | string, elapsedMs?: number) => {
      if (!connector.trafficLog) return;
      const username = (req as any).session?.crmUser || (req as any).session?.user?.email || (req as any).session?.user?.name || 'anonymous';
      trafficLogger.log({
        type: 'debug',
        ts: new Date().toISOString(),
        user: username,
        conn: connector.id,
        tag,
        method: req.method,
        path: (req.url || '').split('?')[0],
        status,
        elapsedMs,
        extra,
      });
    };

    // Debug log de inicio de request
    logDebugEntry('[REQUEST-IN]', `XHR=${isAjax} hbEligible=${hbEligible} forcedHB=${hasForcedHeartbeatPath} mode=${executionMode}`);

    const buildTrafficEntry = (opts: { elapsed: number; ttfb?: number; status: number; reqSize: number; resSize: number; err?: string; resHeaders?: Record<string, string | string[] | undefined> }): TrafficEntry | null => {
      const username = (req as any).session?.crmUser || (req as any).session?.coreUser || (req as any).session?.user?.email || (req as any).session?.user?.name || 'anonymous';
      return {
        ts: new Date(startTime).toISOString(),
        elapsed: opts.elapsed,
        ...(opts.ttfb !== undefined ? { ttfb: opts.ttfb } : {}),
        user: username,
        conn: connector.id,
        method: req.method || 'GET',
        url: req.url || '/',
        status: opts.status,
        reqSize: opts.reqSize,
        resSize: opts.resSize,
        ct: (opts.resHeaders?.['content-type'] || 'unknown') as string,
        xhr: isAjax,
        err: opts.err || null,
        cookies: extractCookieNames(req.headers.cookie),
        reqHdrs: req.headers as Record<string, string | string[] | undefined>,
        resHdrs: opts.resHeaders || {},
      };
    };

    const emitHeartbeatEnd = (status?: number, failed = false) => {
      if (!isHeartbeatActive || heartbeatEndEmitted) return;
      heartbeatEndEmitted = true;
      emitStatus({
        type: "heartbeat-end",
        clientId: bizguardClientId,
        requestId: bizguardRequestId,
        method: req.method || "GET",
        path,
        elapsedMs: Date.now() - startTime,
        status,
        failed,
      });
    };

    res.once('close', () => {
      if (hbTimer) clearTimeout(hbTimer);
      if (hbInterval) clearInterval(hbInterval);
      if (isHeartbeatActive && global.proxyManager) {
        global.proxyManager.heartbeatCount = Math.max(0, global.proxyManager.heartbeatCount - 1);
      }
      emitHeartbeatEnd(undefined, res.destroyed && !res.writableEnded);
    });

    const startHbShield = () => {
      if (!hbEligible || isHeartbeatActive || res.headersSent) return;

      // El primer pulso ocurre 45s después de ser llamado (típicamente al fin del upload).
      // Esto respeta el comportamiento de Cloudflare, que reinicia su timer de 100s (Error 524)
      // en cuanto termina de enviarse el cuerpo del request.
      const remainingTime = hbFirstPulseMs;


      jobId = crypto.randomUUID();
      setBgJob(jobId, {
        status: 'pending',
        startedAt: startTime,
        connectorId: connector.id,
        method: req.method || 'POST',
        path: req.url || '/',
      });

      hbTimer = setTimeout(() => {
        // UPLOAD PROTECTION: Doble chequeo por si acaso, aunque ahora startHbShield se llama al final del upload
        if (!req.complete && isPostLike) {
          const nowElapsed = Math.round((Date.now() - startTime) / 1000);
          logHB(`[HB-WAIT] Request incompleto (upload activo — ${nowElapsed}s) — postergando HB para ${path}`);
          hbTimer = setTimeout(() => startHbShield(), 5000);
          return;
        }

        if (!res.headersSent && !res.destroyed) {
          isHeartbeatActive = true;
          hbStart = Date.now() - (hbFirstPulseMs); 
          if (global.proxyManager) global.proxyManager.heartbeatCount++;
          emitStatus({
            type: "heartbeat-start",
            clientId: bizguardClientId,
            requestId: bizguardRequestId,
            method: req.method || "GET",
            path,
            elapsedMs: Date.now() - startTime,
          });

          if (executionMode === "passive-html") {
              // ── FULL-PAGE NAVIGATION ────────────────────────────────────────
              // Navegación real: escribimos spinner HTML y mantenemos vivo con espacios.
              // Los espacios van dentro de un comentario HTML (<!-- ... -->),
              // por lo que no afectan el parse del HTML final.
              logHB(`[HB-SHIELD] Pasivo (Spaces/HTML) ${path} | Iniciado tras ${Math.round((Date.now()-startTime)/1000)}s (${connector.id})`);
              isHtmlCommentOpen = true;
              res.writeHead(200, { 
                'Content-Type': 'text/html; charset=utf-8', 
                'Transfer-Encoding': 'chunked' 
              });
              const hbInitSec = Math.round((Date.now() - startTime) / 1000);
              const m = Math.floor(hbInitSec/60), s = hbInitSec%60;
              const hbInitLabel = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
              res.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style id="bg-style">*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:#f1f5f9;min-height:100vh;display:flex;align-items:center;justify-content:center}.modal{background:#fff;border-radius:16px;padding:40px 48px;box-shadow:0 8px 32px rgba(0,0,0,.10);text-align:center;min-width:340px;max-width:480px}.spinner{width:52px;height:52px;border:5px solid #e2e8f0;border-top-color:#2563eb;border-radius:50%;animation:spin .9s linear infinite;margin:0 auto 20px}@keyframes spin{to{transform:rotate(360deg)}}h3{font-size:18px;font-weight:600;color:#1e293b;margin-bottom:8px}.sub{color:#64748b;font-size:14px;margin-bottom:20px}.timer{font-size:36px;font-weight:700;color:#2563eb;font-variant-numeric:tabular-nums;letter-spacing:3px}.tlabel{font-size:11px;color:#94a3b8;margin-top:6px;text-transform:uppercase;letter-spacing:1px}.pbar-wrap{width:100%;background:#e2e8f0;border-radius:99px;height:8px;margin-top:20px;overflow:hidden}.pbar{height:8px;border-radius:99px;background:linear-gradient(90deg,#2563eb,#60a5fa);width:0%;transition:width 0.8s ease}.note{font-size:11px;color:#94a3b8;margin-top:18px;line-height:1.5;border-top:1px solid #e2e8f0;padding-top:14px}</style></head><body><div class="modal" id="m"><div class="spinner"></div><h3>&#9203; Procesando archivo...</h3><p class="sub">Los datos se están procesando en el servidor.</p><div class="timer" id="t">${hbInitLabel}</div><div class="tlabel">Tiempo transcurrido</div><div class="pbar-wrap"><div class="pbar" id="pb"></div></div><div class="note">Esta pantalla es generada por BizGuard como protección contra cortes de conexión.<br>No forma parte de la aplicación.</div></div><script>var _s=${hbInitSec},_p=0,_piv=null,_iv=setInterval(function(){_s++;var m=Math.floor(_s/60),mstr=m<10?'0'+m:m,s=_s%60,sstr=s<10?'0'+s:s;document.getElementById("t").textContent=mstr+":"+sstr;_p=_p+(85-_p)*0.005;document.getElementById("pb").style.width=_p.toFixed(1)+"%";},1000);</script><!--`);
              hbInterval = setInterval(() => {
                if (!res.writableEnded && !res.destroyed) {
                  res.write(' ');
                  const elapsed = Math.round((Date.now() - startTime) / 1000);
                  logHB(`[HB-SHIELD] ⏱ ${elapsed}s activa — ${path} (${connector.id})`);
                } else {
                  if (hbInterval) clearInterval(hbInterval);
                }
              }, HB_INTERVAL_MS);
          } else if (executionMode === "xhr-keepalive") {
              // ── XHR / AJAX / FETCH ──────────────────────────────────────────
              // NO escribimos al body HTTP. El cliente espera JSON puro.
              // Usamos TCP socket keepalive para mantener viva la conexión
              // sin corromper el cuerpo de la respuesta.
              const sentInterimPulse = emitInterimProcessingPulse(res);
              logHB(`[HB-SHIELD] Pasivo (${sentInterimPulse ? 'HTTP-102/TCP-KA' : 'TCP-KA'}) ${path} | Iniciado tras ${Math.round((Date.now()-startTime)/1000)}s (${connector.id})`);
              logDebugEntry('[HB-XHR-KA]', `XHR mode | interim102=${sentInterimPulse}`, undefined, Date.now() - startTime);
              try {
                // setKeepAlive(true, delay_ms): el kernel envía TCP ACK/keepalive probes
                // cada `delay_ms` ms, manteniendo vivo el socket ante firewalls/CDN.
                res.socket?.setKeepAlive(true, HB_INTERVAL_MS);
              } catch { /* socket puede no soportarlo en todos los entornos */ }
              hbInterval = setInterval(() => {
                if (!res.writableEnded && !res.destroyed) {
                  const pulseMode = emitInterimProcessingPulse(res) ? '102' : 'tcp-ka';
                  const elapsed = Math.round((Date.now() - startTime) / 1000);
                  logHB(`[HB-SHIELD] ⏱ ${elapsed}s activa — ${path} (${connector.id}) [${pulseMode}]`);
                } else {
                  if (hbInterval) clearInterval(hbInterval);
                }
              }, HB_INTERVAL_MS);
              // No se llama a res.writeHead() aquí: la respuesta HTTP completa
              // (headers + body) será enviada cuando el backend responda.
          } else if (executionMode === "background-job") {
            logHB(`[HB-SHIELD] Activo (Polling/Job) ${path} tras ${Math.round((Date.now()-startTime)/1000)}s (${connector.id})`);
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(renderBgJobPage(jobId || 'error', req.headers['referer'] || '', incomingHost));
          } else {
            logHB(`[HB-SHIELD] Modo sin proteccion activa ${executionMode} para ${path} (${connector.id})`);
          }
        }
      }, remainingTime);
    };

    // ─── CORE NTLM HANDSHAKE (EXCLUSIVO /LoginExterno.aspx) ─────────────────
    const isCoreNtlmRequest = connector.connectorType === "core" && isCoreNtlmPath(req.url);
    const session = (req as any).session;
    if (isCoreNtlmRequest && hasCoreNtlmSessionForConnector(session, connector.id)) {
      const bodyChunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => bodyChunks.push(chunk));
      req.on('end', () => {
        const body = Buffer.concat(bodyChunks);
        const method = (req.method || 'GET').toLowerCase();
        const ntlmFn = (httpntlm as any)[method] || httpntlm.get;
        const queryIdx = (req.url || "").indexOf("?");
        const queryString = queryIdx !== -1 ? (req.url || "").substring(queryIdx) : "";
        const validationUrl = buildCoreNtlmValidationUrl(connector) + queryString;

        if (hbEligible) startHbShield();

        const ntlmHeaders = buildCrmNtlmHeaders(req.headers, body.length);

        ntlmFn({
          username: session.coreUser,
          password: session.corePass,
          domain: session.coreDomain || connector.coreNtlmDomain || "",
          workstation: '',
          url: validationUrl,
          body,
          headers: ntlmHeaders,
          agent,
          timeout: 15000,
          binary: true,
        }, (err: any, ntlmRes: any) => {
          if (hbTimer) clearTimeout(hbTimer);
          if (hbInterval) clearInterval(hbInterval);

          if (err) {
            logHB(`[CORE-NTLM-ERR] ${req.method} ${req.url} → ${err.message}`);
            if (!res.headersSent) { res.writeHead(502); res.end(`NTLM Error: ${err.message}`); }
            return;
          }

          logHB(`[CORE-NTLM-OK] ${req.method} ${req.url} → ${ntlmRes.statusCode}`);
          onMetric(connector.id, ntlmRes.body?.length || 0, Date.now() - startTime);

          if (!res.headersSent) {
            const fwdHeaders = rewriteHeaders(ntlmRes.headers, targetUrl, incomingHost);
            delete fwdHeaders['transfer-encoding'];
            delete fwdHeaders['content-length'];

            let responseBody: Buffer = ntlmRes.body ? (Buffer.isBuffer(ntlmRes.body) ? ntlmRes.body : Buffer.from(ntlmRes.body)) : Buffer.alloc(0);
            const contentEncoding = (fwdHeaders['content-encoding'] || '') as string;

            if (responseBody.length > 0 && (contentEncoding === 'gzip' || contentEncoding === 'deflate')) {
              try {
                responseBody = contentEncoding === 'gzip' ? zlib.gunzipSync(responseBody) : zlib.inflateSync(responseBody);
                delete fwdHeaders['content-encoding'];
              } catch {}
            }

            const contentType = (fwdHeaders['content-type'] || '') as string;
            const isText = (contentType.includes('text') || contentType.includes('javascript') || contentType.includes('json') || contentType.includes('xml')) &&
              !/\.(png|jpg|jpeg|gif|ico|cur|svg)$/i.test(urlPart);

            if (isText && responseBody.length > 0) {
              let bodyStr = responseBody.toString('utf8');
              bodyStr = applyDeepRewrite(bodyStr, targetUrl, incomingHost);
              if (connector.connectorType === "dynamics-crm") {
                bodyStr = rewriteDynamicsCrmClientConfig(bodyStr, incomingHost, proto, connector.entryPath);
              }
              bodyStr = rules.rewriteBody(bodyStr);
              responseBody = Buffer.from(bodyStr, 'utf8');
            }

            fwdHeaders['content-length'] = String(responseBody.length);
            res.writeHead(ntlmRes.statusCode, fwdHeaders);
            res.end(responseBody);
            logHarEntry(connector.id, connector.harLog, {
              startTime,
              elapsedMs: Date.now() - startTime,
              req,
              reqBody: body,
              resStatusCode: ntlmRes.statusCode,
              resHeaders: fwdHeaders,
              resBody: responseBody,
              username: session.coreUser
            });
            if (connector.trafficLog) {
              const te = buildTrafficEntry({ elapsed: Date.now() - startTime, status: ntlmRes.statusCode, reqSize: body.length, resSize: responseBody.length, resHeaders: fwdHeaders });
              if (te) trafficLogger.log(te);
            }
          }
        });
      });
      return;
    }

    // ─── NTLM HANDSHAKE ──────────────────────────────────────────────────────
    if ((connector.isNtlm || connector.connectorType === 'dynamics-crm') && session?.crmUser && session?.crmPass) {
      if (session.crmConnectorId && session.crmConnectorId !== connector.id) {
        logSSO(connector.id, `[CRM-NTLM-MISMATCH] sessionConnector=${session.crmConnectorId} requestConnector=${connector.id} user=${session.crmUser}`);
        if (!res.headersSent) {
          res.writeHead(409, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('La sesión NTLM activa pertenece a otro conector CRM. Reingresa.');
        }
        return;
      }

      const bodyChunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => bodyChunks.push(chunk));
      req.on('end', () => {
        const body = Buffer.concat(bodyChunks);
        const method = (req.method || 'GET').toLowerCase();
        const ntlmFn = (httpntlm as any)[method] || httpntlm.get;
        const requestPath = effectiveReqUrl.split('?')[0] || '/';

        const breakerState = getCrmNtlmBlockState(connector, session.crmUser);
        if (breakerState && !isCrmNtlmNoisePath(requestPath)) {
          const retryAfterSeconds = Math.max(1, Math.ceil((breakerState.blockedUntil - Date.now()) / 1000));
          logSSO(connector.id, `[CRM-NTLM-BREAKER] Bloqueando intento NTLM para usuario=${session.crmUser} path=${requestPath} retryAfter=${retryAfterSeconds}s`);
          if (!res.headersSent) {
            res.writeHead(429, {
              'Content-Type': 'text/plain; charset=utf-8',
              'Retry-After': String(retryAfterSeconds),
            });
            res.end('BizGuard detuvo temporalmente nuevos intentos NTLM para proteger la cuenta AD. Reintenta en unos minutos.');
          }
          return;
        }

        if (hbEligible) startHbShield();

        const ntlmHeaders: Record<string, string> = {};
        for (const [k, v] of Object.entries(options.headers || {})) {
          if (typeof v === 'string') ntlmHeaders[k] = v;
          else if (Array.isArray(v)) ntlmHeaders[k] = v.join(', ');
        }
        if (body.length > 0) ntlmHeaders['content-length'] = String(body.length);

        // NTLM necesita conservar la misma conexión dentro del handshake
        // (Type1/Type2/Type3), pero no debe compartirla con otros requests paralelos.
        // Por eso usamos un agent dedicado por request con keepAlive=true y maxSockets=1.
        const ntlmAgent = isHttps
          ? new https.Agent({
              keepAlive: true,
              maxSockets: 1,
              maxFreeSockets: 0,
              rejectUnauthorized: connector.strictTls === true,
            })
          : new http.Agent({
              keepAlive: true,
              maxSockets: 1,
              maxFreeSockets: 0,
            });

        ntlmFn({
          username: session.crmUser, password: session.crmPass,
          domain: session.crmDomain || connector.ntlmDomain || "",
          workstation: '', url: `${targetUrl.protocol}//${targetUrl.host}${effectiveReqUrl}`,
          body, headers: ntlmHeaders, agent: ntlmAgent, timeout: 15000, binary: true,
        }, (err: any, ntlmRes: any) => {
          if (hbTimer) clearTimeout(hbTimer);
          if (hbInterval) clearInterval(hbInterval);
          ntlmAgent.destroy();

          if (err) {
            logHB(`[NTLM-ERR] ${req.method} ${req.url} → ${err.message}`);
            if (!res.headersSent) { res.writeHead(502); res.end(`NTLM Error: ${err.message}`); }
            logHarEntry(connector.id, connector.harLog, {
              startTime,
              elapsedMs: Date.now() - startTime,
              req,
              reqBody: body,
              resStatusCode: 502,
              resHeaders: {},
              resBody: err.message,
              username: session.crmUser
            });
            if (connector.trafficLog) {
              const te = buildTrafficEntry({ elapsed: Date.now() - startTime, status: 502, reqSize: body.length, resSize: 0, err: err.message, resHeaders: {} });
              if (te) trafficLogger.log(te);
            }
            return;
          }

          logHB(`[NTLM-OK] ${req.method} ${req.url} → ${ntlmRes.statusCode}`);
          onMetric(connector.id, ntlmRes.body?.length || 0, Date.now() - startTime);

          if (!res.headersSent) {
            const fwdHeaders = rewriteHeaders(ntlmRes.headers, targetUrl, incomingHost);
            delete fwdHeaders['transfer-encoding'];
            delete fwdHeaders['content-length']; // Se recalcula después

            let responseBody: Buffer = ntlmRes.body ? (Buffer.isBuffer(ntlmRes.body) ? ntlmRes.body : Buffer.from(ntlmRes.body)) : Buffer.alloc(0);
            const contentEncoding = (fwdHeaders['content-encoding'] || '') as string;

            // Decompress NTLM
            if (responseBody.length > 0 && (contentEncoding === 'gzip' || contentEncoding === 'deflate')) {
              try {
                responseBody = contentEncoding === 'gzip' ? zlib.gunzipSync(responseBody) : zlib.inflateSync(responseBody);
                delete fwdHeaders['content-encoding'];
                logHB(`[NTLM-DECODE] ${req.method} ${req.url} | ${contentEncoding} decompressed`);
              } catch (e: any) { logHB(`[NTLM-WARN] Failed to decompress: ${e.message}`); }
            }

            const contentType = (fwdHeaders['content-type'] || '') as string;
            const contentDisp = (fwdHeaders['content-disposition'] || '') as string;
            const isFileDownload = contentDisp.includes("attachment") || 
                           /excel|spreadsheetml|zip|pdf|octet-stream|wordprocessingml|presentationml/.test(contentType.toLowerCase());

            const isText = (contentType.includes('text') || contentType.includes('javascript') || contentType.includes('json') || contentType.includes('xml')) && 
                          !/\.(png|jpg|jpeg|gif|ico|cur|svg)$/i.test(urlPart);

            if (isText && responseBody.length > 0) {
              let bodyStr = responseBody.toString('utf8');
              bodyStr = applyDeepRewrite(bodyStr, targetUrl, incomingHost);
              if (connector.connectorType === "dynamics-crm") {
                bodyStr = rewriteDynamicsCrmClientConfig(bodyStr, incomingHost, proto, connector.entryPath);
              }
              bodyStr = rules.rewriteBody(bodyStr);
              responseBody = Buffer.from(bodyStr, 'utf8');
            }

            if (isHeartbeatActive) {
              // Detección robusta de binarios post-NTLM
              const firstKB = responseBody.subarray(0, 2048);
              const pkIdx = firstKB.indexOf(Buffer.from([0x50, 0x4B]));
              const pdfIdx = firstKB.indexOf(Buffer.from([0x25, 0x50, 0x44, 0x46]));
              const oleIdx = firstKB.indexOf(Buffer.from([0xD0, 0xCF, 0x11, 0xE0]));

              const isPK = pkIdx !== -1;
              const isPDF = pdfIdx !== -1;
              const isOLE = oleIdx !== -1;

              if (isPK || isPDF || isOLE || isFileDownload) {
                let finalBuffer = responseBody;
                if (isPK && pkIdx > 0) finalBuffer = responseBody.subarray(pkIdx);
                else if (isPDF && pdfIdx > 0) finalBuffer = responseBody.subarray(pdfIdx);
                else if (isOLE && oleIdx > 0) finalBuffer = responseBody.subarray(oleIdx);

                serveAsBlobDownload(res, req, finalBuffer, fwdHeaders, incomingHost, isHtmlCommentOpen, connector.id);
              } else {
                if (res.headersSent) {
                  // Modo full-page nav: headers ya enviados.
                  if (isHtmlCommentOpen) res.write('-->');
                  res.write(responseBody); res.end();
                } else {
                  // Modo TCP-KA (XHR): enviamos respuesta normal.
                  fwdHeaders['content-length'] = String(responseBody.length);
                  res.writeHead(ntlmRes.statusCode, fwdHeaders); res.end(responseBody);
                }
              }
            } else {
              fwdHeaders['content-length'] = String(responseBody.length);
              res.writeHead(ntlmRes.statusCode, fwdHeaders); res.end(responseBody);
            }

            logHarEntry(connector.id, connector.harLog, {
              startTime,
              elapsedMs: Date.now() - startTime,
              req,
              reqBody: body,
              resStatusCode: ntlmRes.statusCode,
              resHeaders: fwdHeaders,
              resBody: responseBody,
              username: session.crmUser
            });
            if (ntlmRes.statusCode === 401) {
              recordCrmNtlmFailure(connector, session.crmUser, requestPath, ntlmRes.statusCode);
            } else if (ntlmRes.statusCode && ntlmRes.statusCode < 400) {
              resetCrmNtlmFailureState(connector, session.crmUser);
            }
            if (connector.trafficLog) {
              const te = buildTrafficEntry({ elapsed: Date.now() - startTime, status: ntlmRes.statusCode, reqSize: body.length, resSize: responseBody.length, resHeaders: fwdHeaders });
              if (te) trafficLogger.log(te);
            }
          }
        });
      });
      return;
    }

    // ─── STANDARD PROXY FLOW ─────────────────────────────────────────────────
    const reqBodyChunks: Buffer[] = [];
    if (hbEligible) {
      if (req.complete) startHbShield();
      else req.on('end', () => {
        logHB(`[UPLOAD-DONE] Subida completada para ${path}. Iniciando cuenta regresiva de 45s para HB.`);
        startHbShield();
      });
      res.on('close', () => {
        if (hbTimer) clearTimeout(hbTimer);
        if (hbInterval) clearInterval(hbInterval);
        emitHeartbeatEnd(undefined, res.destroyed && !res.writableEnded);
      });
    }

    const internalHost = targetUrl.host;
    const suspiciousHosts = [internalHost, "localhost:3000", "127.0.0.1:3000", "0.0.0.0:3000"];
    const encodedHosts = suspiciousHosts.map(h => encodeURIComponent(h));
    const uniqueSuspicious = Array.from(new Set([...suspiciousHosts, ...encodedHosts]));

    const proxyReq = (isHttps ? https : http).request(options, (proxyRes) => {
      const ttfbMs = Date.now() - startTime; // TTFB real — tiempo hasta primer byte del backend
      onMetric(connector.id, 0, Date.now() - startTime);

      const contentType = (proxyRes.headers["content-type"] || "").toLowerCase();
      const contentDisp = (proxyRes.headers["content-disposition"] || "").toLowerCase();
      const contentEncoding = (proxyRes.headers["content-encoding"] || "").toLowerCase();

      const isFileDownload = contentDisp.includes("attachment") || 
                     /excel|spreadsheetml|zip|pdf|octet-stream|wordprocessingml|presentationml/.test(contentType);

      if (isFileDownload && hbTimer) { clearTimeout(hbTimer); hbTimer = null; }

      const isText = contentType.includes("text") || contentType.includes("javascript") || contentType.includes("json") || contentType.includes("xml");
      const needsRewrite = isHeartbeatActive || (!isFileDownload && isText);
      const finalHeaders = rewriteHeaders(proxyRes.headers, targetUrl, incomingHost);

      // ─── REDIRECT HANDLING POST-HB ─────────────────────────────────────────
      // Si el HB estuvo activo y el servidor nos da un redirect (301, 302, etc), 
      // debemos forzarlo vía JS porque el navegador ya recibió un 200 OK parcial.
      if (isHeartbeatActive && [301, 302, 303, 307, 308].includes(proxyRes.statusCode || 0)) {
        const location = finalHeaders['location'] as string;
        if (location) {
          logHB(`[HB-REDIRECT] Forzando redirección cliente a ${location} tras HB activo (${path})`);
          res.write(rules.getRedirectScript(location, isHtmlCommentOpen));
          res.end();
          if (jobId) {
            updateBgJob(jobId, (job) => ({
              ...job,
              status: 'done',
              statusCode: 200,
              responseHeaders: finalHeaders,
              responseBody: Buffer.alloc(0),
            }));
          }
          logHarEntry(connector.id, connector.harLog, {
            startTime,
            elapsedMs: Date.now() - startTime,
            req,
            reqBody: reqBodyChunks.length > 0 ? Buffer.concat(reqBodyChunks) : null,
            resStatusCode: proxyRes.statusCode || 302,
            resHeaders: finalHeaders,
            resBody: '',
            username: (req as any).session?.crmUser || (req as any).session?.user?.name || (req as any).session?.user?.email
          });
          if (connector.trafficLog) {
            const te = buildTrafficEntry({ elapsed: Date.now() - startTime, ttfb: ttfbMs, status: proxyRes.statusCode || 302, reqSize: 0, resSize: 0, resHeaders: finalHeaders });
            if (te) trafficLogger.log(te);
          }
          return;
        }
      }

      if (needsRewrite) {
        delete finalHeaders["content-length"];
        delete finalHeaders["content-encoding"];

        let chunks: Buffer[] = [];
        proxyRes.on("data", (chunk) => { chunks.push(chunk); onMetric(connector.id, chunk.length); });
        proxyRes.on("end", () => {
          if (hbTimer) clearTimeout(hbTimer);
          if (hbInterval) clearInterval(hbInterval);

          let buffer = Buffer.concat(chunks);
          
          // Decompress
          if (buffer.length > 0 && (contentEncoding === 'gzip' || contentEncoding === 'deflate')) {
            try {
              buffer = contentEncoding === 'gzip' ? zlib.gunzipSync(buffer) : zlib.inflateSync(buffer);
              logHB(`[HB-DECODE] ${req.method} ${path} | ${contentEncoding} decompressed`);
            } catch (e: any) { logHB(`[HB-WARN] Failed to decompress: ${e.message}`); }
          }

          // ─── DETECCIÓN ROBUSTA DE BINARIOS ─────────────────────────────────────
          // Buscamos firmas en los primeros 2KB para ignorar basura/espacios iniciales.
          const firstKB = buffer.subarray(0, 2048);
          const pkIdx = firstKB.indexOf(Buffer.from([0x50, 0x4B, 0x03, 0x04]));
          const pkIdxShort = firstKB.indexOf(Buffer.from([0x50, 0x4B]));
          const pdfIdx = firstKB.indexOf(Buffer.from([0x25, 0x50, 0x44, 0x46]));
          const oleIdx = firstKB.indexOf(Buffer.from([0xD0, 0xCF, 0x11, 0xE0]));

          const finalPkIdx = pkIdx !== -1 ? pkIdx : pkIdxShort;
          const isPK = finalPkIdx !== -1;
          const isPDF = pdfIdx !== -1;
          const isOLE = oleIdx !== -1;

          if (isHeartbeatActive && (isPK || isPDF || isOLE || isFileDownload)) {
            let finalBuffer = buffer;
            if (isPK && finalPkIdx > 0) {
              logHB(`[HB-GUARD] PK detectado en offset ${finalPkIdx}, recortando buffer...`);
              finalBuffer = buffer.subarray(finalPkIdx);
            } else if (isPDF && pdfIdx > 0) {
              logHB(`[HB-GUARD] PDF detectado en offset ${pdfIdx}, recortando buffer...`);
              finalBuffer = buffer.subarray(pdfIdx);
            } else if (isOLE && oleIdx > 0) {
              logHB(`[HB-GUARD] OLE detectado en offset ${oleIdx}, recortando buffer...`);
              finalBuffer = buffer.subarray(oleIdx);
            }
            serveAsBlobDownload(res, req, finalBuffer, proxyRes.headers, incomingHost, isHtmlCommentOpen, connector.id);
            
            logHarEntry(connector.id, connector.harLog, {
              startTime,
              elapsedMs: Date.now() - startTime,
              req,
              reqBody: reqBodyChunks.length > 0 ? Buffer.concat(reqBodyChunks) : null,
              resStatusCode: proxyRes.statusCode || 200,
              resHeaders: finalHeaders,
              resBody: finalBuffer,
              username: (req as any).session?.crmUser || (req as any).session?.user?.name || (req as any).session?.user?.email
            });
            if (connector.trafficLog) {
              const reqSize = reqBodyChunks.reduce((a, b) => a + b.length, 0);
              const te = buildTrafficEntry({ elapsed: Date.now() - startTime, ttfb: ttfbMs, status: proxyRes.statusCode || 200, reqSize, resSize: finalBuffer.length, resHeaders: finalHeaders });
              if (te) trafficLogger.log(te);
            }
            return;
          }

          if (isText && !isPK && !isPDF && !isOLE) {
            let body = buffer.toString("utf8");
            body = applyDeepRewrite(body, targetUrl, incomingHost);
            body = body.replace(/0\.0\.0\.0:3000/g, incomingHost);
            body = rules.rewriteBody(body);
            buffer = Buffer.from(body, "utf8");
          }

          if (isHeartbeatActive) {
            if (!res.writableEnded) {
              if (res.headersSent) {
                // Modo full-page nav: headers ya enviados (spinner HTML abierto).
                // Cerramos el comentario HTML y adjuntamos el buffer de respuesta.
                if (isHtmlCommentOpen) {
                  res.write(`-->
<script id="bg-cleanup-script">
  (function(){
    if (typeof _iv !== 'undefined') clearInterval(_iv);
    var m = document.getElementById("m");
    if (m) m.remove();
    var s = document.getElementById("bg-style");
    if (s) s.remove();
    var self = document.getElementById("bg-cleanup-script");
    if (self) self.remove();
  })();
</script>`);
                }
                res.write(buffer); res.end();
              } else {
                // Modo TCP-KA (XHR): headers NO enviados todavía.
                // Enviamos respuesta HTTP completa normal con headers del backend.
                logHB(`[HB-SHIELD] TCP-KA completo — enviando respuesta normal ${path} (${connector.id})`);
                logDebugEntry('[HB-TCP-KA-DONE]', `body=${buffer.length}B`, proxyRes.statusCode, Date.now() - startTime);
                finalHeaders['content-length'] = String(buffer.length);
                res.writeHead(proxyRes.statusCode || 200, finalHeaders);
                res.end(buffer);
              }
            }
          } else if (!res.headersSent) {
            finalHeaders['content-length'] = String(buffer.length);
            res.writeHead(proxyRes.statusCode || 200, finalHeaders);
            res.end(buffer);
          }

          if (jobId) {
            if (isHeartbeatActive) {
              updateBgJob(jobId, (job) => ({
                ...job,
                status: 'done',
                statusCode: proxyRes.statusCode,
                responseHeaders: finalHeaders,
                responseBody: buffer,
              }));
            } else {
              deleteBgJob(jobId);
            }
          }

          logHarEntry(connector.id, connector.harLog, {
            startTime,
            elapsedMs: Date.now() - startTime,
            req,
            reqBody: reqBodyChunks.length > 0 ? Buffer.concat(reqBodyChunks) : null,
            resStatusCode: proxyRes.statusCode || 200,
            resHeaders: finalHeaders,
            resBody: buffer,
            username: (req as any).session?.crmUser || (req as any).session?.user?.name || (req as any).session?.user?.email
          });
          if (connector.trafficLog) {
            const reqSize = reqBodyChunks.reduce((a, b) => a + b.length, 0);
            const te = buildTrafficEntry({ elapsed: Date.now() - startTime, ttfb: ttfbMs, status: proxyRes.statusCode || 200, reqSize, resSize: buffer.length, resHeaders: finalHeaders });
            if (te) trafficLogger.log(te);
          }
        });

      } else {
        // Direct Streaming (Files / Binaries without rewriting)
        delete finalHeaders["content-encoding"];
        if (!res.headersSent) res.writeHead(proxyRes.statusCode || 200, finalHeaders);
        let responseBodyBytes = 0;
        proxyRes.on("data", (chunk) => {
          onMetric(connector.id, chunk.length);
          if (!res.destroyed) res.write(chunk);
          responseBodyBytes += chunk.length;
        });
        proxyRes.on("end", () => {
          if (hbTimer) clearTimeout(hbTimer);
          if (hbInterval) clearInterval(hbInterval);
          res.end();
          if (jobId) {
            if (isHeartbeatActive) {
              updateBgJob(jobId, (job) => ({
                ...job,
                status: 'done',
                statusCode: proxyRes.statusCode,
                responseHeaders: finalHeaders,
                responseBody: Buffer.alloc(0),
              }));
            } else {
              deleteBgJob(jobId);
            }
          }
          logHarEntry(connector.id, connector.harLog, {
            startTime,
            elapsedMs: Date.now() - startTime,
            req,
            reqBody: reqBodyChunks.length > 0 ? Buffer.concat(reqBodyChunks) : null,
            resStatusCode: proxyRes.statusCode || 200,
            resHeaders: finalHeaders,
            overrideResBodySize: responseBodyBytes,
            username: (req as any).session?.crmUser || (req as any).session?.user?.name || (req as any).session?.user?.email
          });
          if (connector.trafficLog) {
            const reqSize = reqBodyChunks.reduce((a, b) => a + b.length, 0);
            const te = buildTrafficEntry({ elapsed: Date.now() - startTime, ttfb: ttfbMs, status: proxyRes.statusCode || 200, reqSize, resSize: responseBodyBytes, resHeaders: finalHeaders });
            if (te) trafficLogger.log(te);
          }
        });
      }
    });

    proxyReq.on("error", (e) => {
      console.error(`[Proxy] Error para ${connector.name}:`, e);
      if (hbTimer) clearTimeout(hbTimer);
      if (hbInterval) clearInterval(hbInterval);
      if (!res.headersSent) { res.writeHead(502); res.end("Bad Gateway"); }
      logHarEntry(connector.id, connector.harLog, {
        startTime,
        elapsedMs: Date.now() - startTime,
        req,
        reqBody: reqBodyChunks.length > 0 ? Buffer.concat(reqBodyChunks) : null,
        resStatusCode: 502,
        resHeaders: {},
        resBody: e.message,
        username: (req as any).session?.crmUser || (req as any).session?.user?.name || (req as any).session?.user?.email
      });
      if (jobId) {
        if (isHeartbeatActive) {
          updateBgJob(jobId, (job) => ({
            ...job,
            status: 'error',
            error: e.message,
          }));
        } else {
          deleteBgJob(jobId);
        }
      }
      if (connector.trafficLog) {
        const reqSize = reqBodyChunks.reduce((a, b) => a + b.length, 0);
        const te = buildTrafficEntry({ elapsed: Date.now() - startTime, status: 502, reqSize, resSize: 0, err: e.message, resHeaders: {} });
        if (te) trafficLogger.log(te);
      }
    });

    let requestBodyBytes = 0;
    req.on("data", (chunk: Buffer) => {
      requestBodyBytes += chunk.length;
      onMetric(connector.id, chunk.length);
      if (connector.harLog) {
        reqBodyChunks.push(chunk);
      }
      if (requestBodyBytes > MAX_BODY_BYTES) {
        req.unpipe(proxyReq); proxyReq.destroy();
        if (hbTimer) clearTimeout(hbTimer); if (hbInterval) clearInterval(hbInterval);
        if (!res.headersSent) { res.writeHead(413); res.end('Request Entity Too Large'); }
        req.resume();
      }
    });

    req.pipe(proxyReq);
  });

  return server;
}
