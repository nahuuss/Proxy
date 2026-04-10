import http from "http";
import https from "https";
import crypto from "crypto";
import httpntlm from "httpntlm";
import { Connector } from "./connectors";
import { logHB } from "./logger-hb";

export type MetricCallback = (id: string, bytes: number, latency?: number) => void;

// Configuración Heartbeat Shield (anti Cloudflare 524)
const HB_FIRST_PULSE_MS = 45000;  // 45s = margen para cargas pesadas antes de latidos
const HB_INTERVAL_MS = 15000;     // Enviar espacio cada 15s para mantener viva la conexión

// Límite de tamaño de body en requests entrantes (protección contra OOM).
// Configurable via MAX_REQUEST_BODY_MB env var. Default: 500 MB.
const MAX_BODY_BYTES = parseInt(process.env.MAX_REQUEST_BODY_MB || '500') * 1024 * 1024;

// ─── Background Job Store ────────────────────────────────────────────────────
// Permite que BizGuard siga esperando al backend aunque Azure/cliente corte la
// conexión HTTP. El job vive en el proceso Node.js hasta completar (sin timeout).
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
// Limpieza automática: jobs > 30 min se eliminan
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [id, job] of bgJobs) {
    if (job.startedAt < cutoff) bgJobs.delete(id);
  }
}, 10 * 60 * 1000).unref();
// ─────────────────────────────────────────────────────────────────────────────
// REESCRITOR PROFUNDO DE URLS (v1.3.1)
// Maneja variantes literales, hexadecimales (\x3a) y URL-encoded (%3a)
// para asegurar que el CRM no escape al proxy en JS dinámico.
function applyDeepRewrite(body: string, targetUrl: URL, incomingHost: string): string {
  if (!body) return body;
  
  const targetHost = targetUrl.host;      // ej: arbuewvcrmapp50:5555
  const targetHostname = targetUrl.hostname; // ej: arbuewvcrmapp50
  
  const escapedHost = targetHost.replace(/\./g, '\\.');
  const escapedHostname = targetHostname.replace(/\./g, '\\.');
  
  let newBody = body;

  // 1. URLs absolutas (http/https) -> root-relative
  // Buscamos con y sin escape de slashes para cubrir JSON y JS strings
  const absolutePattern = (h: string) => new RegExp(`https?:\\\\?\/\\\\?\/` + h + `(:\\d+)?`, 'gi');
  newBody = newBody.replace(absolutePattern(escapedHost), '');
  newBody = newBody.replace(absolutePattern(escapedHostname), '');
  
  // 2. Variantes codificadas en Hex (\x3a, \x2f) comunes en CRM JS
  const hexHost = escapedHost.replace(':', '\\\\x3a');
  const hexHostname = escapedHostname.replace(':', '\\\\x3a');
  newBody = newBody.replace(new RegExp(hexHost, 'gi'), incomingHost);
  newBody = newBody.replace(new RegExp(hexHostname, 'gi'), incomingHost);

  // 3. Variantes codificadas por URL (%3a)
  const urlHost = escapedHost.replace(':', '%3a');
  const urlHostname = escapedHostname.replace(':', '%3a');
  newBody = newBody.replace(new RegExp(urlHost, 'gi'), incomingHost);
  newBody = newBody.replace(new RegExp(urlHostname, 'gi'), incomingHost);

  // 4. Hostname literal sin protocolo (útil para variables JS que concatenan después)
  // Solo reemplazamos si no es parte de una URL absoluta ya procesada.
  // IMPORTANTE: Si es el hostname corto, tratamos de capturar el puerto si está pegado.
  const portSuffixPattern = targetUrl.port ? `(:${targetUrl.port})?` : '';
  newBody = newBody.replace(new RegExp(escapedHost, 'gi'), incomingHost);
  newBody = newBody.replace(new RegExp(escapedHostname + portSuffixPattern, 'gi'), incomingHost);

  // 5. Soporte para / encodado (%2f) recurrente en URLs serializadas de CRM
  const urlEncodedSlashHost = urlHost.replace('\/', '%2f');
  newBody = newBody.replace(new RegExp(urlEncodedSlashHost, 'gi'), incomingHost);

  return newBody;
}
// ─────────────────────────────────────────────────────────────────────────────

export function createProxyServer(connector: Connector, onMetric: MetricCallback) {
  const targetUrl = new URL(connector.targetUrl);
  const isHttps = targetUrl.protocol === "https:";
  const agent = isHttps
    ? new https.Agent({ keepAlive: true, rejectUnauthorized: connector.strictTls === true })
    : new http.Agent({ keepAlive: true });

  const server = http.createServer((req, res) => {
    const startTime = Date.now();

    // ── Background Job API (/__ bizguard_job/{id}/status|result) ──────────────
    // Interceptado antes de cualquier proxy logic. No requiere auth porque el
    // jobId es un UUID no adivinable y se genera en la misma sesión.
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
    // ─────────────────────────────────────────────────────────────────────────

    const headers = { ...req.headers };
    
    // 1. Limpiar headers previos de proxy/Cloudflare para evitar conflictos
    Object.keys(headers).forEach(h => {
      if (h.startsWith('cf-') || h.startsWith('x-forwarded-')) {
        delete headers[h];
      }
    });

    // 2. Inyectar cabeceras de reenvío CORRECTAS
    const incomingHost = req.headers.host || connector.publicHost;
    const incomingProto = (req.headers['x-forwarded-proto'] as string) || 
                         ((req.socket as any).encrypted ? "https" : "http");
    
    // Si el host viene de Cloudflare/Proxy externo, mantenerlo. Si es localhost, es dev.
    const isInternalAuth = connector.id === "internal-dashboard";
    const hostToSend = isInternalAuth ? incomingHost : targetUrl.host;
    
    // El proto debe ser https si el host público no es localhost
    const proto = (incomingHost.includes("localhost") || incomingHost.includes("127.0.0.1")) 
                  ? "http" : "https"; 

    if (req.url?.includes("/api/auth")) {
      console.log(`[Proxy Debug] ConnectorID="${connector.id}" Host="${incomingHost}" Proto="${incomingProto}" -> ForwardHost="${hostToSend}" ForwardProto="${proto}"`);
    }
    
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
        "accept-encoding": "identity",
      },
      agent,
    };

    // Variables de estado del Heartbeat — declaradas antes del bloque NTLM para evitar TDZ
    let jobId: string | null = null;
    let isHeartbeatActive = false;
    let isHtmlCommentOpen = false;
    let hbTimer: NodeJS.Timeout | null = null;
    let hbInterval: NodeJS.Timeout | null = null;
    let hbStart: number | null = null;

    // ─── NTLM HANDSHAKE COMPLETO ─────────────────────────────────────────────
    // httpntlm.method() hace los 3 pasos NTLM (Type1→Type2 challenge→Type3)
    // en la misma conexión TCP. Buffereamos body y response (CRM 2013, no streaming).
    const session = (req as any).session;
    if ((connector.isNtlm || connector.connectorType === 'dynamics-crm') && session?.crmUser && session?.crmPass) {
      const bodyChunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => bodyChunks.push(chunk));
      req.on('end', () => {
        const body = Buffer.concat(bodyChunks);
        const method = (req.method || 'GET').toLowerCase();
        const ntlmFn = (httpntlm as any)[method] || httpntlm.get;

        // IMPORTANTE: no pasar el agent keepAlive a httpntlm.
        // NTLM es per-conexión TCP — si httpntlm reutiliza una conexión ya usada,
        // el servidor rechaza con 401 porque el estado NTLM de esa conexión expiró.
        // httpntlm crea su propia conexión interna para los 3 pasos del handshake.
        const ntlmHeaders: Record<string, string> = {};
        for (const [k, v] of Object.entries(options.headers || {})) {
          if (typeof v === 'string') ntlmHeaders[k] = v;
          else if (Array.isArray(v)) ntlmHeaders[k] = v.join(', ');
        }
        if (body.length > 0) ntlmHeaders['content-length'] = String(body.length);

        ntlmFn({
          username: session.crmUser,
          password: session.crmPass,
          domain: session.crmDomain || connector.ntlmDomain || "",
          workstation: '',
          url: `${targetUrl.protocol}//${targetUrl.host}${req.url}`,
          body,
          headers: ntlmHeaders,
          binary: true, // Recibir body como Buffer para no corromper binarios (imágenes, Excel, etc.)
        }, (err: any, ntlmRes: any) => {
          if (err) {
            logHB(`[NTLM-ERR] ${req.method} ${req.url} → ${err.message}`);
            if (!res.headersSent) { res.writeHead(502); res.end(`NTLM Error: ${err.message}`); }
            return;
          }
          logHB(`[NTLM-OK] ${req.method} ${req.url} → ${ntlmRes.statusCode}`);
          onMetric(connector.id, ntlmRes.body?.length || 0, Date.now() - startTime);
          if (hbTimer) clearTimeout(hbTimer);
          if (hbInterval) clearInterval(hbInterval);
          if (!res.headersSent) {
            const fwdHeaders = { ...ntlmRes.headers };
            delete fwdHeaders['transfer-encoding'];

            // Reescribir Location header (redireccionamientos del CRM al host interno)
            if (fwdHeaders['location']) {
              let loc = fwdHeaders['location'] as string;
              loc = loc.replace(new RegExp(`https?:\\/\\/${targetUrl.host.replace(/\./g, '\\.')}`, 'gi'), '');
              loc = loc.replace(new RegExp(targetUrl.host.replace(/\./g, '\\.'), 'gi'), incomingHost);
              fwdHeaders['location'] = loc;
            }

            // Reescribir Set-Cookie (domain y flags Secure)
            if (fwdHeaders['set-cookie']) {
              const cookies = Array.isArray(fwdHeaders['set-cookie']) ? fwdHeaders['set-cookie'] : [fwdHeaders['set-cookie']];
              fwdHeaders['set-cookie'] = cookies.map((c: string) => {
                let nc = c.replace(new RegExp(`domain=${targetUrl.hostname.replace(/\./g, '\\.')}`, 'gi'), `domain=${incomingHost.split(':')[0]}`);
                nc = nc.replace(/;\s*Secure\b/gi, '');
                nc = nc.replace(/;\s*SameSite=None\b/gi, '; SameSite=Lax');
                return nc;
              });
            }

            // Reescribir contenido HTML/JS/CSS: reemplazar hostname interno por host público
            let responseBody: Buffer = ntlmRes.body
              ? (Buffer.isBuffer(ntlmRes.body) ? ntlmRes.body : Buffer.from(ntlmRes.body))
              : Buffer.alloc(0);

            const contentType = (fwdHeaders['content-type'] || '') as string;
            const contentEncoding = (fwdHeaders['content-encoding'] || '') as string;
            const isGzipped = contentEncoding === 'gzip';

            // Descompresión automática si el servidor ignoró 'accept-encoding: identity'
            if (isGzipped && responseBody.length > 0) {
              try {
                // require() inline: evita que Turbopack/Webpack intenten bundlear zlib.
                // zlib es built-in de Node.js y no debe ser procesado por el bundler.
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const { gunzipSync } = require('zlib') as typeof import('zlib');
                responseBody = gunzipSync(responseBody);
                delete fwdHeaders['content-encoding']; // El browser lo recibe descomprimido
                logHB(`[NTLM-DECODE] GET ${req.url} | Gzip detected & decompressed`);
              } catch (e: any) {
                logHB(`[NTLM-WARN] Failed to gunzip: ${e.message} URL=${req.url}`);
              }
            }

            const isText = (contentType.includes('text') || contentType.includes('javascript') || contentType.includes('json') || contentType.includes('xml')) && 
                          !/\.(png|jpg|jpeg|gif|ico|cur|svg)$/i.test((req.url || '').split('?')[0]);

            if (isText && responseBody.length > 0) {
              let bodyStr = responseBody.toString('utf8');
              bodyStr = applyDeepRewrite(bodyStr, targetUrl, incomingHost);
              responseBody = Buffer.from(bodyStr, 'utf8');
            }

            fwdHeaders['content-length'] = String(responseBody.length);
            res.writeHead(ntlmRes.statusCode, fwdHeaders);
            res.end(responseBody);
          }
        });
      });
      req.on('error', () => { if (!res.headersSent) { res.writeHead(502); res.end(); } });
      return; // Skip flujo proxy normal
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Heartbeat Shield: determinar si esta request es elegible.
    // El conector interno (dashboard, /api/stats, /login, _next) nunca necesita HB —
    // apunta a localhost:3000 que no pasa por Cloudflare.
    const urlPart = (req.url || '').split('?')[0].toLowerCase();
    const isInternalConnector = connector.id === "internal-dashboard";
    
    // CRM 2013 sirve muchos recursos estáticos vía .aspx o .ashx
    const isCrmResource = /(_imgs|_static|webresources|icon\.aspx|css\.aspx|js\.aspx|resx\.ashx)/i.test(urlPart);
    const isExplicitStatic = /\.(js|css|axd|ashx|png|jpg|jpeg|gif|ico|woff|woff2|svg|svgz|ttf|otf|eot|cur|xaml|xap|map|wasm|mp4)$/.test(urlPart);
    const isImage = /\.(png|jpg|jpeg|gif|ico|cur|svg)$/.test(urlPart) || urlPart.includes('icon.aspx');
    
    const isStatic = isExplicitStatic || isCrmResource;
    
    const hbForceUrls = (connector.hbForceUrls || []).map(u => u.toLowerCase());
    const isXhrForcedUrl = hbForceUrls.length > 0 && hbForceUrls.some(u => urlPart.startsWith(u));
    const isXhrExcluded = !!req.headers['x-requested-with'] && !isXhrForcedUrl;

    // Elegible para Heartbeat si no es estática, no es imagen y no es ruta interna.
    const isPostLike = req.method !== 'GET' && req.method !== 'HEAD';
    const hbEligible = !isInternalConnector && !isStatic && !isImage && (isPostLike || !isXhrExcluded);
    
    // Log diagnóstico inicial (omitir para rutas internas — genera ruido innecesario)
    const isXhr = !!req.headers['x-requested-with'];
    const path = (req.url || '').split('?')[0];
    if (!isInternalConnector) {
      logHB(`[BG-CHECK] ${req.method} ${path} | Static: ${isStatic} | XHR: ${isXhr} | Eligible: ${hbEligible}`);
    }


    if (hbEligible) {
      // Registrar Job ID para seguimiento (Universal v4)
      jobId = crypto.randomUUID();
      bgJobs.set(jobId, {
        status: 'pending',
        startedAt: startTime,
        connectorId: connector.id,
        method: req.method || 'POST',
        path: req.url || '/',
      });
      logHB(`[BG-TRACK] ID: ${jobId} | Target: ${connector.id} | HB-Timer: ${HB_FIRST_PULSE_MS}ms`);

      // Iniciar temporizador de protección
      hbTimer = setTimeout(() => {
        if (!res.headersSent && !res.destroyed) {
          isHeartbeatActive = true;
          hbStart = Date.now() - HB_FIRST_PULSE_MS; 
          
          if (global.proxyManager) global.proxyManager.heartbeatCount++;

          // HEARTBEAT HIBRIDO AUTOMATICO (V4)
          if (req.method === 'GET' || isXhr) {
            // GET o AJAX: Usar escudo pasivo (espacios). 
            // Los clientes AJAX/JSON suelen ignorar espacios en blanco al inicio.
            logHB(`[HB-SHIELD] Pasivo (Spaces) ${path} | XHR: ${isXhr} (${connector.id})`);
            res.writeHead(200, { 
              'Content-Type': isXhr ? 'application/json; charset=utf-8' : 'text/html; charset=utf-8', 
              'Transfer-Encoding': 'chunked' 
            });
            
            // Si es navegación GET full-page, enviamos el HTML del contador.
            if (!isXhr && req.method === 'GET') {
              isHtmlCommentOpen = true; 
              const hbInitSec = Math.round(HB_FIRST_PULSE_MS / 1000);
              const hbInitMin = Math.floor(hbInitSec / 60);
              const hbInitSS = hbInitSec % 60;
              const hbInitLabel = `${hbInitMin < 10 ? '0' + hbInitMin : hbInitMin}:${hbInitSS < 10 ? '0' + hbInitSS : hbInitSS}`;
              res.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:#f1f5f9;min-height:100vh;display:flex;align-items:center;justify-content:center}.modal{background:#fff;border-radius:16px;padding:40px 48px;box-shadow:0 8px 32px rgba(0,0,0,.10);text-align:center;min-width:340px;max-width:480px}.spinner{width:52px;height:52px;border:5px solid #e2e8f0;border-top-color:#2563eb;border-radius:50%;animation:spin .9s linear infinite;margin:0 auto 20px}@keyframes spin{to{transform:rotate(360deg)}}h3{font-size:18px;font-weight:600;color:#1e293b;margin-bottom:8px}.sub{color:#64748b;font-size:14px;margin-bottom:20px}.timer{font-size:36px;font-weight:700;color:#2563eb;font-variant-numeric:tabular-nums;letter-spacing:3px}.tlabel{font-size:11px;color:#94a3b8;margin-top:6px;text-transform:uppercase;letter-spacing:1px}.pbar-wrap{width:100%;background:#e2e8f0;border-radius:99px;height:8px;margin-top:20px;overflow:hidden}.pbar{height:8px;border-radius:99px;background:linear-gradient(90deg,#2563eb,#60a5fa);width:0%;transition:width 0.8s ease}.note{font-size:11px;color:#94a3b8;margin-top:18px;line-height:1.5;border-top:1px solid #e2e8f0;padding-top:14px}</style></head><body><div class="modal" id="m"><div class="spinner"></div><h3>&#9203; Generando archivo...</h3><p class="sub">Los datos se están procesando en el servidor.</p><div class="timer" id="t">${hbInitLabel}</div><div class="tlabel">Tiempo transcurrido</div><div class="pbar-wrap"><div class="pbar" id="pb"></div></div><div class="note">Esta pantalla es generada por BizGuard como protección contra cortes de conexión.<br>No forma parte de la aplicación.</div></div><script>var _s=${hbInitSec},_p=0,_piv=null,_iv=setInterval(function(){_s++;var m=Math.floor(_s/60),s=_s%60;document.getElementById("t").textContent=(m<10?"0"+m:m)+":"+(s<10?"0"+s:s);_p=_p+(85-_p)*0.005;document.getElementById("pb").style.width=_p.toFixed(1)+"%";},1000);</script><!--`);
            } else {
               // AJAX o POST largo: enviar primer espacio para abrir el chunked stream
               res.write(' ');
            }
            
            // Intervalo de mantenimiento (envío de espacios cada 15s)
            hbInterval = setInterval(() => {
              if (!res.writableEnded && !res.destroyed) {
                res.write(' ');
                const elapsed = Math.round((Date.now() - (hbStart ?? Date.now())) / 1000);
                logHB(`[HB-SHIELD] ⏱ ${elapsed}s activa — ${path} | XHR: ${isXhr} (${connector.id})`);
              } else {
                if (hbInterval) clearInterval(hbInterval);
              }
            }, HB_INTERVAL_MS);
          } else {
            // POST/PUT/... Navegación Full: Usar Background Job activo (polling)
            logHB(`[HB-SHIELD] Activo (Polling/Job) ${path} (${connector.id})`);
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(renderBgJobPage(jobId || 'error'));
          }
        }
      }, HB_FIRST_PULSE_MS);

      res.on('close', () => {
        if (hbTimer) clearTimeout(hbTimer);
        if (hbInterval) clearInterval(hbInterval);
        if (isHeartbeatActive && global.proxyManager) {
          global.proxyManager.heartbeatCount = Math.max(0, global.proxyManager.heartbeatCount - 1);
          const elapsed = Math.round((Date.now() - (hbStart ?? Date.now())) / 1000);
          const path = (req.url || '').split('?')[0];
          logHB(`[HB-SHIELD] Conexión cerrada por cliente después de ${elapsed}s — ${path} (${connector.id})`);
        }
        // Si era una request rastreada y backend aún no respondió, avisar que el job sigue vivo
        if (jobId) {
          const fj = bgJobs.get(jobId);
          if (fj && fj.status === 'pending') {
            logHB(`[BG-JOB] Cliente desconectado — backend sigue corriendo → resultado en: /__bizguard_job/${jobId}/result`);
          }
        }
      });
    }

    const internalHost = targetUrl.host;
    const suspiciousHosts = [internalHost, "localhost:3000", "127.0.0.1:3000", "0.0.0.0:3000"];
    const encodedHosts = suspiciousHosts.map(h => encodeURIComponent(h));
    const uniqueSuspicious = Array.from(new Set([...suspiciousHosts, ...encodedHosts]));

    // IMPORTANTE — NO agregar timeout a proxyReq.
    //
    // Arquitectura de conexiones en BizGuard:
    //   Browser → Cloudflare → BizGuard (puerto del conector, HTTP) → Backend
    //
    // Existen DOS sockets completamente independientes:
    //   1. res (cliente): BizGuard → Cloudflare → Browser
    //      El Heartbeat Shield escribe chunks a este socket cada 15s (luego de 55s de espera)
    //      para evitar que Cloudflare emita un error 524 (timeout de ~100s de Cloudflare).
    //      Ver HB_FIRST_PULSE_MS y HB_INTERVAL_MS arriba.
    //
    //   2. proxyReq (backend): BizGuard → Backend
    //      Socket SEPARADO e INDEPENDIENTE del socket cliente.
    //      El Heartbeat mantiene vivo el socket del CLIENTE, NO este socket.
    //      Puede (y debe) esperar indefinidamente: hay operaciones legítimas —reportes
    //      Excel, generación de documentos, queries lentas— que tardan varios minutos.
    //
    // Si se agrega un timeout aquí (ej: timeout: 120_000), se rompen todas las operaciones
    // que tarden más de ese tiempo, exactamente el caso de uso del Heartbeat Shield.
    // El sistema operativo gestiona el TCP keepalive del socket backend.
    const proxyReq = (isHttps ? https : http).request(options, (proxyRes) => {
      const latency = Date.now() - startTime;
      onMetric(connector.id, 0, latency);

      const contentType = (proxyRes.headers["content-type"] || "").toLowerCase();
      const contentDisp = (proxyRes.headers["content-disposition"] || "").toLowerCase();

      // FILE GUARD: detectar archivos
      const isFileDownload = contentDisp.includes("attachment") || 
                     contentType.includes("excel") || 
                     contentType.includes("spreadsheetml") ||
                     contentType.includes("zip") ||
                     contentType.includes("pdf") ||
                     contentType.includes("octet-stream");

      // Cancelar heartbeat timer si es un archivo
      if (isFileDownload && hbTimer) {
        clearTimeout(hbTimer);
        hbTimer = null;
      }

      const isText = contentType.includes("text") || contentType.includes("javascript") || contentType.includes("json") || contentType.includes("xml");
      const needsRewrite = !isFileDownload && (isText || isHeartbeatActive);

      // Reescribir headers de Location y Cookies (siempre)
      const finalHeaders = { ...proxyRes.headers };

      if (finalHeaders["location"]) {
        let loc = (Array.isArray(finalHeaders["location"]) ? finalHeaders["location"][0] : finalHeaders["location"]) as string;
        uniqueSuspicious.forEach(sh => {
          if (loc.includes(sh)) {
            if (sh.includes("%")) {
              const encodedCurrent = encodeURIComponent(incomingHost);
              loc = loc.replace(new RegExp(sh.replace(/\./g, "\\."), "gi"), encodedCurrent);
            } else {
              loc = loc.replace(new RegExp(`https?:\\/\\/${sh.replace(/\./g, "\\.")}`, "gi"), `http://${incomingHost}`);
              loc = loc.replace(new RegExp(sh.replace(/\./g, "\\."), "gi"), incomingHost);
            }
          }
        });
        finalHeaders["location"] = loc;
      }

      if (finalHeaders["set-cookie"]) {
        const cookies = Array.isArray(finalHeaders["set-cookie"]) ? finalHeaders["set-cookie"] : [finalHeaders["set-cookie"]];
        finalHeaders["set-cookie"] = cookies.map(c => {
          let nc = c;
          // Reescribir dominio backend → proxy
          uniqueSuspicious.forEach(sh => {
            const domainMatch = sh.split(':')[0].replace(/\./g, "\\.");
            nc = nc.replace(new RegExp(`domain=${domainMatch}`, "gi"), `domain=${incomingHost.split(':')[0]}`);
          });
          // Quitar flag Secure: BizGuard sirve sobre HTTP; cookies Secure son rechazadas por el browser
          nc = nc.replace(/;\s*Secure\b/gi, '');
          // SameSite=None requiere Secure — sin Secure el browser lo rechaza también
          nc = nc.replace(/;\s*SameSite=None\b/gi, '; SameSite=Lax');
          return nc;
        });
        // Log diagnóstico: cookies en respuesta del backend (solo cookies no de sesión)
        const cookieNames = (finalHeaders["set-cookie"] as string[]).map(c => c.split('=')[0].trim());
        if (cookieNames.some(n => n.toLowerCase().includes('filedownload') || n.toLowerCase().includes('download'))) {
          console.log(`[COOKIE-DBG] Set-Cookie del backend: ${JSON.stringify(finalHeaders["set-cookie"])} (${connector.id})`);
        }
      }

      if (needsRewrite) {
        // MODO BUFFER: acumular para reescribir texto
        delete finalHeaders["content-length"];
        delete finalHeaders["content-encoding"];

        let chunks: Buffer[] = [];

        proxyRes.on("data", (chunk) => {
          chunks.push(chunk);
          onMetric(connector.id, chunk.length);
        });

        proxyRes.on("end", () => {
          // Cancelar heartbeat
          if (hbTimer) clearTimeout(hbTimer);
          if (hbInterval) clearInterval(hbInterval);

          let buffer = Buffer.concat(chunks);
          
          // Verificar firma binaria
          const isPK = buffer.length > 2 && buffer[0] === 0x50 && buffer[1] === 0x4B;
          const isPDF = buffer.length > 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;

          if (isHeartbeatActive) {
            // Si el heartbeat ya está activo, servir como Blob download via JS
            if (isPK || isPDF || isFileDownload) {
              const elapsed = Math.round((Date.now() - (hbStart ?? Date.now())) / 1000);
              logHB(`[HB-SHIELD] Backend respondió después de ${elapsed}s — sirviendo blob (${connector.id})`);
              serveAsBlobDownload(res, req, buffer, proxyRes.headers, incomingHost, isHtmlCommentOpen);
              return;
            }
          }

          if (isText && !isPK && !isPDF) {
            let body = buffer.toString("utf8");
            body = applyDeepRewrite(body, targetUrl, incomingHost);
            body = body.replace(/0\.0\.0\.0:3000/g, incomingHost);
            buffer = Buffer.from(body, "utf8");
          }

          if (isHeartbeatActive) {
            // Heartbeat activo + texto: inyectar solo si se abrió un comentario HTML
            if (!res.writableEnded) {
              if (isHtmlCommentOpen) {
                res.write('-->');
              } else if (isXhr) {
                logHB(`[HB-CLEAN] Evitando inyección de "-->" en respuesta XHR de ${path} (${connector.id})`);
              }
              res.write(buffer);
              res.end();
            }
          } else {
            if (!res.headersSent) {
              res.writeHead(proxyRes.statusCode || 200, finalHeaders);
              res.end(buffer);
            }
          }

          // SIEMPRE guardar en bgJobs si tenemos un forcedJobId para que el polling de v2 lo encuentre
          if (jobId) {
            bgJobs.set(jobId, {
              ...bgJobs.get(jobId)!,
              status: 'done',
              statusCode: proxyRes.statusCode,
              responseHeaders: finalHeaders,
              responseBody: buffer
            });
          }
        });

      } else if (isFileDownload && isHeartbeatActive) {
        // Archivo durante heartbeat: acumular y servir como Blob JS
        let fChunks: Buffer[] = [];
        proxyRes.on("data", (chunk) => {
          fChunks.push(chunk);
          onMetric(connector.id, chunk.length);
        });
        proxyRes.on("end", () => {
          if (hbTimer) clearTimeout(hbTimer);
          if (hbInterval) clearInterval(hbInterval);
          const elapsed = Math.round((Date.now() - (hbStart ?? Date.now())) / 1000);
          const dataBuffer = Buffer.concat(fChunks);
          logHB(`[HB-SHIELD] Backend respondió después de ${elapsed}s — sirviendo blob (${connector.id})`);
          serveAsBlobDownload(res, req, dataBuffer, proxyRes.headers, incomingHost, isHtmlCommentOpen);

          if (jobId) {
            bgJobs.set(jobId, {
              ...bgJobs.get(jobId)!,
              status: 'done',
              statusCode: proxyRes.statusCode,
              responseHeaders: finalHeaders,
              responseBody: dataBuffer
            });
          }
        });

      } else {
        // MODO STREAMING DIRECTO: archivos y binarios sin heartbeat
        delete finalHeaders["content-encoding"];
        
        if (!res.headersSent) {
          res.writeHead(proxyRes.statusCode || 200, finalHeaders);
        }

        proxyRes.on("data", (chunk) => {
          onMetric(connector.id, chunk.length);
          if (!res.destroyed) res.write(chunk);
        });

        proxyRes.on("end", () => {
          if (hbTimer) clearTimeout(hbTimer);
          if (hbInterval) clearInterval(hbInterval);
          res.end();
          
          if (jobId) {
            bgJobs.set(jobId, {
              ...bgJobs.get(jobId)!,
              status: 'done',
              statusCode: proxyRes.statusCode,
              responseHeaders: finalHeaders,
              responseBody: Buffer.alloc(0) // streaming directo no guarda cuerpo por ahora para evitar OOM
            });
          }
        });
      }
    });

    proxyReq.on("error", (e) => {
      console.error(`[Proxy] Error para ${connector.name}:`, e);
      if (hbTimer) clearTimeout(hbTimer);
      if (hbInterval) clearInterval(hbInterval);
      if (!res.headersSent) {
        res.writeHead(502);
        res.end("Bad Gateway");
      }
    });

    // Body size limit: cuenta bytes del request entrante y corta si supera el límite.
    let requestBodyBytes = 0;
    req.on("data", (chunk: Buffer) => {
      requestBodyBytes += chunk.length;
      onMetric(connector.id, chunk.length);
      if (requestBodyBytes > MAX_BODY_BYTES) {
        req.unpipe(proxyReq);
        proxyReq.destroy();
        if (hbTimer) clearTimeout(hbTimer);
        if (hbInterval) clearInterval(hbInterval);
        if (!res.headersSent) { res.writeHead(413); res.end('Request Entity Too Large'); }
        req.resume(); // drenar el socket para permitir cleanup limpio
      }
    });

    req.pipe(proxyReq);
  });

  return server;
}

// Blob Download via JavaScript (patrón del wrapper v48)
function serveAsBlobDownload(
  res: http.ServerResponse, 
  req: http.IncomingMessage, 
  dataBuffer: Buffer, 
  originalHeaders: http.IncomingHttpHeaders, 
  publicHost: string,
  isHtmlCommentOpen: boolean
) {
  const contentType = (originalHeaders['content-type'] || '').split(';')[0].trim() || 'application/octet-stream';
  let mimeType = contentType;
  if (mimeType === 'application/octet-stream') {
    if (dataBuffer.length > 2 && dataBuffer[0] === 0x50 && dataBuffer[1] === 0x4B)
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    else if (dataBuffer.length > 4 && dataBuffer[0] === 0x25 && dataBuffer[1] === 0x50)
      mimeType = 'application/pdf';
  }

  const dispMatch = ((originalHeaders['content-disposition'] || '') as string).match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
  // Sanitización por allowlist: solo caracteres seguros. JSON.stringify() para embedding sin riesgo de XSS.
  const rawFilename = dispMatch ? dispMatch[1].replace(/["']/g, '') : 'archivo.xlsx';
  const filename = rawFilename.replace(/[^\w\s.\-()[\]]/g, '_');
  const safeFilenameJs = JSON.stringify(filename);   // produce: "reporte_2026.xlsx" — seguro en JS
  const safeMimeJs = JSON.stringify(mimeType);        // idem para mimeType del backend

  const b64 = dataBuffer.toString('base64');
  const referer = req.headers['referer'] || '';
  const backUrl = JSON.stringify(referer.includes(publicHost) ? referer : '/');

  const closeTag = isHtmlCommentOpen ? '-->' : '';
  const script = `${closeTag}<script>(function(){if(typeof _iv!=="undefined")clearInterval(_iv);if(typeof _piv!=="undefined"){clearInterval(_piv);var pb=document.getElementById("pb");if(pb){pb.style.transition="width 0.3s ease";pb.style.width="100%";}}try{var d=atob('${b64}'),u=new Uint8Array(d.length);for(var i=0;i<d.length;i++)u[i]=d.charCodeAt(i);var bl=new Blob([u],{type:${safeMimeJs}}),url=URL.createObjectURL(bl),a=document.createElement('a');a.href=url;a.download=${safeFilenameJs};document.body.appendChild(a);a.click();document.getElementById('m').innerHTML='<div style="font-size:52px;margin-bottom:16px">&#10004;</div><h3 style="color:#16a34a;font-size:20px;margin-bottom:8px">Descarga iniciada</h3><p class="sub">'+${safeFilenameJs}+'</p><p class="sub" style="margin-top:6px">La descarga comenz\u00F3 en tu navegador.</p><button onclick="window.history.length > 1 ? window.history.back() : window.location.replace(${backUrl})" style="margin-top:24px;padding:10px 28px;background:#2563eb;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer">&#8592; Volver</button>';}catch(e){document.getElementById('m').innerHTML='<h3 style="color:#dc2626">Error</h3><p class="sub">'+e.message+'</p>';}})();</script>`;
  
  if (!res.writableEnded) {
    res.write(script);
    res.end();
  }
  
  logHB(`[HB-BLOB] ${Math.round(dataBuffer.length / 1024)}KB via JS Blob: ${filename}`);
}

// Página de polling para Background Jobs
// Se devuelve inmediatamente al cliente. Mientras Azure puede cerrar la conexión,
// BizGuard mantiene la request al backend viva indefinidamente en su proceso Node.js.
function renderBgJobPage(jobId: string): string {
  const safeId = JSON.stringify(jobId);
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>BizGuard \u2014 Procesando...</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:#f1f5f9;min-height:100vh;display:flex;align-items:center;justify-content:center}.modal{background:#fff;border-radius:16px;padding:40px 48px;box-shadow:0 8px 32px rgba(0,0,0,.10);text-align:center;min-width:340px;max-width:480px}.spinner{width:52px;height:52px;border:5px solid #e2e8f0;border-top-color:#2563eb;border-radius:50%;animation:spin .9s linear infinite;margin:0 auto 20px}@keyframes spin{to{transform:rotate(360deg)}}h3{font-size:18px;font-weight:600;color:#1e293b;margin-bottom:8px}.sub{color:#64748b;font-size:14px;margin-bottom:20px}.timer{font-size:36px;font-weight:700;color:#2563eb;font-variant-numeric:tabular-nums;letter-spacing:3px}.tlabel{font-size:11px;color:#94a3b8;margin-top:6px;text-transform:uppercase;letter-spacing:1px}.pbar-wrap{width:100%;background:#e2e8f0;border-radius:99px;height:8px;margin-top:20px;overflow:hidden}.pbar{height:8px;border-radius:99px;background:linear-gradient(90deg,#2563eb,#60a5fa);width:0%;transition:width 0.8s ease}.note{font-size:11px;color:#94a3b8;margin-top:18px;line-height:1.5;border-top:1px solid #e2e8f0;padding-top:14px}.ic-done{width:52px;height:52px;background:#22c55e;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:28px;color:#fff}.ic-err{width:52px;height:52px;background:#ef4444;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:28px;color:#fff}</style></head><body><div class="modal" id="m"><div class="spinner" id="ic"></div><h3 id="tt">\u23f3 Procesando archivo...</h3><p class="sub" id="sb">BizGuard ejecuta la operaci\u00f3n en segundo plano.</p><div class="timer" id="t">00:00</div><div class="tlabel">Tiempo transcurrido</div><div class="pbar-wrap"><div class="pbar" id="pb"></div></div><div class="note">BizGuard mantiene la operaci\u00f3n activa aunque la conexi\u00f3n sea interrumpida.<br>No cierre esta ventana hasta ver el resultado.</div></div><script>
var jid=${safeId},_s=0,_p=0,_done=false;
if(window.self!==window.top){try{window.top.location.href=window.location.href;}catch(e){}}
var _iv=setInterval(function(){_s++;var m=Math.floor(_s/60),s=_s%60;document.getElementById('t').textContent=(m<10?'0'+m:m)+':'+(s<10?'0'+s:s);_p=_p+(90-_p)*0.004;document.getElementById('pb').style.width=_p.toFixed(1)+'%';},1000);
function poll(){if(_done)return;fetch('/__bizguard_job/'+jid+'/status').then(function(r){return r.json();}).then(function(d){if(d.status==='done'){_done=true;clearInterval(_iv);getResult();}else if(d.status==='error'){_done=true;clearInterval(_iv);showErr(d.error||'Error desconocido');}else{setTimeout(poll,2000);}}).catch(function(){setTimeout(poll,3000);});}
function getResult(){document.getElementById('pb').style.width='100%';fetch('/__bizguard_job/'+jid+'/result').then(function(r){var ct=r.headers.get('content-type')||'';if(ct.includes('json')){r.json().then(function(j){var msg=j.message||j.Message||j.descripcion||j.Descripcion||j.error||j.Error||JSON.stringify(j).substring(0,300);var ok=!j.error&&!j.Error&&r.ok;showDone(ok?'\u2705 Operaci\u00f3n completada':'\u26a0\ufe0f Servidor respondi\u00f3',msg);});}else if(ct.includes('text/html')){r.text().then(function(){showDone('\u2705 Completado','El servidor proces\u00f3 la solicitud correctamente.');});}else{r.blob().then(function(bl){var url=URL.createObjectURL(bl);var a=document.createElement('a');a.href=url;a.download='resultado';a.click();showDone('\u2705 Archivo descargado','La descarga comenz\u00f3 autom\u00e1ticamente.');});}}).catch(function(e){showErr(e.message);});}
function showDone(t,m){document.getElementById('ic').outerHTML='<div class="ic-done" id="ic">\u2713</div>';document.getElementById('tt').textContent=t;document.getElementById('sb').textContent=m;}
function showErr(m){document.getElementById('ic').outerHTML='<div class="ic-err" id="ic">\u2717</div>';document.getElementById('tt').textContent='Error en el servidor';document.getElementById('sb').textContent=m;}
poll();
</script></body></html>`;
}
