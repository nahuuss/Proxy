import http from "http";
import https from "https";
import crypto from "crypto";
import httpntlm from "httpntlm";
import zlib from "zlib";
import { Connector } from "./connectors";
import { logHB } from "./logger-hb";
import { applyDeepRewrite, serveAsBlobDownload, renderBgJobPage, rewriteHeaders } from "./proxy-utils";
import { getRulesFor } from "./rules";

export type MetricCallback = (id: string, bytes: number, latency?: number) => void;

// Configuración Heartbeat Shield (anti Cloudflare 524)
const HB_FIRST_PULSE_MS = 45000;  // 45s = margen para cargas pesadas antes de latidos
const HB_INTERVAL_MS = 15000;     // Enviar espacio cada 15s para mantener viva la conexión

// Límite de tamaño de body en requests entrantes (protección contra OOM).
const MAX_BODY_BYTES = parseInt(process.env.MAX_REQUEST_BODY_MB || '500') * 1024 * 1024;

// ─── Background Job Store ────────────────────────────────────────────────────
interface BgJob {
  status: 'pending' | 'done' | 'error';
  startedAt: number;
  connectorId: string;
  method: string;
  path: string;
  statusCode?: number;
  responseHeaders?: Record<string, string | string[] | undefined>;
  responseBody?: Buffer;
  error?: string;
}
const bgJobs = new Map<string, BgJob>();
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [id, job] of bgJobs) {
    if (job.startedAt < cutoff) bgJobs.delete(id);
  }
}, 10 * 60 * 1000).unref();

// ─────────────────────────────────────────────────────────────────────────────

export function createProxyServer(connector: Connector, onMetric: MetricCallback) {
  const targetUrl = new URL(connector.targetUrl);
  const isHttps = targetUrl.protocol === "https:";
  const agent = isHttps
    ? new https.Agent({ keepAlive: true, rejectUnauthorized: connector.strictTls === true })
    : new http.Agent({ keepAlive: true });

  const server = http.createServer((req, res) => {
    const startTime = Date.now();

    // ── Background Job API (/__bizguard_job/{id}/status|result) ──────────────
    const rawUrlPath = (req.url || '').split('?')[0].toLowerCase();
    if (rawUrlPath.startsWith('/__bizguard_job/')) {
      const parts = rawUrlPath.replace('/__bizguard_job/', '').split('/');
      const jobId = parts[0];
      const action = parts[1] || 'status';
      const job = bgJobs.get(jobId);
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
        return;
      }
      res.writeHead(404); res.end();
      return;
    }

    const headers = { ...req.headers };
    Object.keys(headers).forEach(h => {
      if (h.startsWith('cf-') || h.startsWith('x-forwarded-')) delete headers[h];
    });

    const incomingHost = req.headers.host || connector.publicHost;
    const isInternalAuth = connector.id === "internal-dashboard";
    const hostToSend = isInternalAuth ? incomingHost : targetUrl.host;
    const proto = (incomingHost.includes("localhost") || incomingHost.includes("127.0.0.1")) ? "http" : "https";

    const options: http.RequestOptions = {
      hostname: targetUrl.hostname,
      port: targetUrl.port || (isHttps ? 443 : 80),
      path: req.url,
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

    const urlPart = (req.url || '').split('?')[0].toLowerCase();
    const rules = getRulesFor(connector.connectorType);
    
    const isInternalConnector = connector.id === "internal-dashboard";
    const isCrmResource = /(_imgs|_static|webresources|icon\.aspx|css\.aspx|js\.aspx|resx\.ashx)/i.test(urlPart);
    const isExplicitStatic = /\.(js|css|axd|ashx|png|jpg|jpeg|gif|ico|woff|woff2|svg|svgz|ttf|otf|eot|cur|xaml|xap|map|wasm|mp4)$/.test(urlPart);
    const isImage = /\.(png|jpg|jpeg|gif|ico|cur|svg)$/.test(urlPart) || urlPart.includes('icon.aspx');
    const isStatic = isExplicitStatic || isCrmResource;
    
    const isPostLike = req.method !== 'GET' && req.method !== 'HEAD';
    const hbEligible = !isInternalConnector && rules.isHbEligible(req, urlPart, isStatic, isImage);
    const path = (req.url || '').split('?')[0];

    const startHbShield = () => {
      if (!hbEligible || isHeartbeatActive || res.headersSent) return;

      // El primer pulso ocurre 45s después de ser llamado (típicamente al fin del upload).
      // Esto respeta el comportamiento de Cloudflare, que reinicia su timer de 100s (Error 524)
      // en cuanto termina de enviarse el cuerpo del request.
      const remainingTime = HB_FIRST_PULSE_MS;


      jobId = crypto.randomUUID();
      bgJobs.set(jobId, {
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
          hbStart = Date.now() - (HB_FIRST_PULSE_MS); 
          if (global.proxyManager) global.proxyManager.heartbeatCount++;

          if (req.method === 'GET' || isPostLike) {
            logHB(`[HB-SHIELD] Pasivo (Spaces) ${path} | Iniciado tras ${Math.round((Date.now()-startTime)/1000)}s (${connector.id})`);
            res.writeHead(200, { 
              'Content-Type': isPostLike ? 'application/json; charset=utf-8' : 'text/html; charset=utf-8', 
              'Transfer-Encoding': 'chunked' 
            });
            
            // Solo enviamos el spinner visual en peticiones GET de navegación real.
            // Para POSTs (subidas) enviamos solo un espacio para mantener viva la conexión.
            if (!isPostLike && req.method === 'GET') {
              isHtmlCommentOpen = true;
              const hbInitSec = Math.round((Date.now() - startTime) / 1000);
              const m = Math.floor(hbInitSec/60), s = hbInitSec%60;
              const hbInitLabel = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
              res.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:#f1f5f9;min-height:100vh;display:flex;align-items:center;justify-content:center}.modal{background:#fff;border-radius:16px;padding:40px 48px;box-shadow:0 8px 32px rgba(0,0,0,.10);text-align:center;min-width:340px;max-width:480px}.spinner{width:52px;height:52px;border:5px solid #e2e8f0;border-top-color:#2563eb;border-radius:50%;animation:spin .9s linear infinite;margin:0 auto 20px}@keyframes spin{to{transform:rotate(360deg)}}h3{font-size:18px;font-weight:600;color:#1e293b;margin-bottom:8px}.sub{color:#64748b;font-size:14px;margin-bottom:20px}.timer{font-size:36px;font-weight:700;color:#2563eb;font-variant-numeric:tabular-nums;letter-spacing:3px}.tlabel{font-size:11px;color:#94a3b8;margin-top:6px;text-transform:uppercase;letter-spacing:1px}.pbar-wrap{width:100%;background:#e2e8f0;border-radius:99px;height:8px;margin-top:20px;overflow:hidden}.pbar{height:8px;border-radius:99px;background:linear-gradient(90deg,#2563eb,#60a5fa);width:0%;transition:width 0.8s ease}.note{font-size:11px;color:#94a3b8;margin-top:18px;line-height:1.5;border-top:1px solid #e2e8f0;padding-top:14px}</style></head><body><div class="modal" id="m"><div class="spinner"></div><h3>&#9203; Procesando archivo...</h3><p class="sub">Los datos se están procesando en el servidor.</p><div class="timer" id="t">${hbInitLabel}</div><div class="tlabel">Tiempo transcurrido</div><div class="pbar-wrap"><div class="pbar" id="pb"></div></div><div class="note">Esta pantalla es generada por BizGuard como protección contra cortes de conexión.<br>No forma parte de la aplicación.</div></div><script>var _s=${hbInitSec},_p=0,_piv=null,_iv=setInterval(function(){_s++;var m=Math.floor(_s/60),mstr=m<10?'0'+m:m,s=_s%60,sstr=s<10?'0'+s:s;document.getElementById("t").textContent=mstr+":"+sstr;_p=_p+(85-_p)*0.005;document.getElementById("pb").style.width=_p.toFixed(1)+"%";},1000);</script><!--`);
            } else {
              res.write(' ');
            }
            hbInterval = setInterval(() => {
              if (!res.writableEnded && !res.destroyed) {
                res.write(' ');
                const elapsed = Math.round((Date.now() - startTime) / 1000);
                logHB(`[HB-SHIELD] ⏱ ${elapsed}s activa — ${path} (${connector.id})`);
              } else {
                if (hbInterval) clearInterval(hbInterval);
              }
            }, HB_INTERVAL_MS);
          } else {
            logHB(`[HB-SHIELD] Activo (Polling/Job) ${path} tras ${Math.round((Date.now()-startTime)/1000)}s (${connector.id})`);
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(renderBgJobPage(jobId || 'error'));
          }
        }
      }, remainingTime);
    };

    // ─── NTLM HANDSHAKE ──────────────────────────────────────────────────────
    const session = (req as any).session;
    if ((connector.isNtlm || connector.connectorType === 'dynamics-crm') && session?.crmUser && session?.crmPass) {
      const bodyChunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => bodyChunks.push(chunk));
      req.on('end', () => {
        const body = Buffer.concat(bodyChunks);
        const method = (req.method || 'GET').toLowerCase();
        const ntlmFn = (httpntlm as any)[method] || httpntlm.get;

        if (hbEligible) startHbShield();

        const ntlmHeaders: Record<string, string> = {};
        for (const [k, v] of Object.entries(options.headers || {})) {
          if (typeof v === 'string') ntlmHeaders[k] = v;
          else if (Array.isArray(v)) ntlmHeaders[k] = v.join(', ');
        }
        if (body.length > 0) ntlmHeaders['content-length'] = String(body.length);

        ntlmFn({
          username: session.crmUser, password: session.crmPass,
          domain: session.crmDomain || connector.ntlmDomain || "",
          workstation: '', url: `${targetUrl.protocol}//${targetUrl.host}${req.url}`,
          body, headers: ntlmHeaders, binary: true,
        }, (err: any, ntlmRes: any) => {
          if (hbTimer) clearTimeout(hbTimer);
          if (hbInterval) clearInterval(hbInterval);

          if (err) {
            logHB(`[NTLM-ERR] ${req.method} ${req.url} → ${err.message}`);
            if (!res.headersSent) { res.writeHead(502); res.end(`NTLM Error: ${err.message}`); }
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
            const isText = (contentType.includes('text') || contentType.includes('javascript') || contentType.includes('json') || contentType.includes('xml')) && 
                          !/\.(png|jpg|jpeg|gif|ico|cur|svg)$/i.test(urlPart);

            if (isText && responseBody.length > 0) {
              let bodyStr = responseBody.toString('utf8');
              bodyStr = applyDeepRewrite(bodyStr, targetUrl, incomingHost);
              bodyStr = rules.rewriteBody(bodyStr);
              responseBody = Buffer.from(bodyStr, 'utf8');
            }

            if (isHeartbeatActive) {
              if (isHtmlCommentOpen) res.write('-->');
              res.write(responseBody); res.end();
            } else {
              fwdHeaders['content-length'] = String(responseBody.length);
              res.writeHead(ntlmRes.statusCode, fwdHeaders); res.end(responseBody);
            }
          }
        });
      });
      return;
    }

    // ─── STANDARD PROXY FLOW ─────────────────────────────────────────────────
    if (hbEligible) {
      if (req.complete) startHbShield();
      else req.on('end', () => {
        logHB(`[UPLOAD-DONE] Subida completada para ${path}. Iniciando cuenta regresiva de 45s para HB.`);
        startHbShield();
      });
      res.on('close', () => {
        if (hbTimer) clearTimeout(hbTimer);
        if (hbInterval) clearInterval(hbInterval);
        if (isHeartbeatActive && global.proxyManager) global.proxyManager.heartbeatCount = Math.max(0, global.proxyManager.heartbeatCount - 1);
      });
    }

    const internalHost = targetUrl.host;
    const suspiciousHosts = [internalHost, "localhost:3000", "127.0.0.1:3000", "0.0.0.0:3000"];
    const encodedHosts = suspiciousHosts.map(h => encodeURIComponent(h));
    const uniqueSuspicious = Array.from(new Set([...suspiciousHosts, ...encodedHosts]));

    const proxyReq = (isHttps ? https : http).request(options, (proxyRes) => {
      onMetric(connector.id, 0, Date.now() - startTime);

      const contentType = (proxyRes.headers["content-type"] || "").toLowerCase();
      const contentDisp = (proxyRes.headers["content-disposition"] || "").toLowerCase();
      const contentEncoding = (proxyRes.headers["content-encoding"] || "").toLowerCase();

      const isFileDownload = contentDisp.includes("attachment") || 
                     /excel|spreadsheetml|zip|pdf|octet-stream/.test(contentType);

      if (isFileDownload && hbTimer) { clearTimeout(hbTimer); hbTimer = null; }

      const isText = contentType.includes("text") || contentType.includes("javascript") || contentType.includes("json") || contentType.includes("xml");
      const needsRewrite = !isFileDownload && (isText || isHeartbeatActive);
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
            bgJobs.set(jobId, { ...bgJobs.get(jobId)!, status: 'done', statusCode: 200, responseHeaders: finalHeaders, responseBody: Buffer.alloc(0) });
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

          const isPK = buffer.length > 2 && buffer[0] === 0x50 && buffer[1] === 0x4B;
          const isPDF = buffer.length > 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;

          if (isHeartbeatActive && (isPK || isPDF || isFileDownload)) {
            serveAsBlobDownload(res, req, buffer, proxyRes.headers, incomingHost, isHtmlCommentOpen);
            return;
          }

          if (isText && !isPK && !isPDF) {
            let body = buffer.toString("utf8");
            body = applyDeepRewrite(body, targetUrl, incomingHost);
            body = body.replace(/0\.0\.0\.0:3000/g, incomingHost);
            body = rules.rewriteBody(body);
            buffer = Buffer.from(body, "utf8");
          }

          if (isHeartbeatActive) {
            if (!res.writableEnded) {
              if (isHtmlCommentOpen) res.write('-->');
              res.write(buffer); res.end();
            }
          } else if (!res.headersSent) {
            res.writeHead(proxyRes.statusCode || 200, finalHeaders);
            res.end(buffer);
          }

          if (jobId) {
            bgJobs.set(jobId, { ...bgJobs.get(jobId)!, status: 'done', statusCode: proxyRes.statusCode, responseHeaders: finalHeaders, responseBody: buffer });
          }
        });

      } else {
        // Direct Streaming (Files / Binaries without rewriting)
        delete finalHeaders["content-encoding"];
        if (!res.headersSent) res.writeHead(proxyRes.statusCode || 200, finalHeaders);
        proxyRes.on("data", (chunk) => { onMetric(connector.id, chunk.length); if (!res.destroyed) res.write(chunk); });
        proxyRes.on("end", () => {
          if (hbTimer) clearTimeout(hbTimer);
          if (hbInterval) clearInterval(hbInterval);
          res.end();
          if (jobId) {
            bgJobs.set(jobId, { ...bgJobs.get(jobId)!, status: 'done', statusCode: proxyRes.statusCode, responseHeaders: finalHeaders, responseBody: Buffer.alloc(0) });
          }
        });
      }
    });

    proxyReq.on("error", (e) => {
      console.error(`[Proxy] Error para ${connector.name}:`, e);
      if (hbTimer) clearTimeout(hbTimer);
      if (hbInterval) clearInterval(hbInterval);
      if (!res.headersSent) { res.writeHead(502); res.end("Bad Gateway"); }
    });

    let requestBodyBytes = 0;
    req.on("data", (chunk: Buffer) => {
      requestBodyBytes += chunk.length;
      onMetric(connector.id, chunk.length);
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
