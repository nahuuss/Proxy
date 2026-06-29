import { Connector, getConnectors } from "./connectors";
import { createProxyServer } from "./proxy-server";
import http from "http";
import https from "https";
import net from "net";
import tls from "tls";
import os from "os";
import { EventEmitter } from "events";
import { getSettings, GlobalSettings } from "./settings";
import { decode } from "@auth/core/jwt";
import fs from "fs";
import path from "path";
import { getLastCompactionTime, getCurrentCompactionIntervalMs } from "./db";
import { hasCoreNtlmSessionForConnector, isCoreNtlmPath } from "./core-ntlm";

declare global {
  var proxyManager: ProxyManager | undefined;
}

// Validación real de sesión usando el mismo decode() que NextAuth v5 internamente.
// No hace llamadas de red ni accede a la DB — solo descifra el JWE con AUTH_SECRET.
// Overhead: ~0.1ms (AES-CBC decrypt). Retorna null si el token es inválido o expirado.
const SESSION_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "next-auth.session-token",
];

async function verifySession(cookieHeader: string): Promise<any | null> {
  if (!process.env.AUTH_SECRET) return null;
  const pairs = new Map<string, string>(
    cookieHeader.split(';')
      .map(p => { const i = p.indexOf('='); return i === -1 ? null : [p.slice(0, i).trim(), p.slice(i + 1).trim()] as [string, string]; })
      .filter(Boolean) as [string, string][]
  );
  for (const name of SESSION_COOKIE_NAMES) {
    const token = pairs.get(name);
    if (!token) continue;
    try {
      const payload = await decode({ token, secret: process.env.AUTH_SECRET, salt: name });
      if (payload && (payload.exp as number) > Math.floor(Date.now() / 1000)) return payload;
    } catch { continue; }
  }
  return null;
}

// Rate limiter: sliding window en memoria, sin dependencias externas.
// Default: 300 req/min por IP. Configurable via RATE_LIMIT_RPM env var.
// Usa cf-connecting-ip (Cloudflare Tunnel) como fuente primaria del IP real del cliente.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_RPM || '300');

class RateLimiter {
  private store = new Map<string, number[]>();

  constructor() {
    // Limpiar IPs inactivas cada 5 minutos para liberar memoria
    setInterval(() => this.cleanup(), 300_000).unref();
  }

  check(ip: string): boolean {
    const now = Date.now();
    const cut = now - RATE_LIMIT_WINDOW_MS;
    const ts = (this.store.get(ip) || []).filter(t => t > cut);
    if (ts.length >= RATE_LIMIT_MAX) {
      this.store.set(ip, ts);
      return false;
    }
    this.store.set(ip, [...ts, now]);
    return true;
  }

  private cleanup() {
    const cut = Date.now() - RATE_LIMIT_WINDOW_MS;
    for (const [ip, ts] of this.store) {
      if (ts.every(t => t <= cut)) this.store.delete(ip);
    }
  }
}
const rateLimiter = new RateLimiter();

class ProxyManager extends EventEmitter {
  private servers: Map<number, http.Server> = new Map();
  private proxyServers: Map<string, { server: ReturnType<typeof createProxyServer>; connector: Connector }> = new Map();
  private stats: Map<string, { requests: number, bytes: number, latency?: number, activePing?: number, isOnline?: boolean }> = new Map();
  private pingStats: Record<string, number> = {};
  private statsPending = false;
  private recentLogs: any[] = [];
  private logsPending = false;
  private lastTotalBytes = 0;
  private lastSyncTime = Date.now();
  private syncInFlight = false;
  private prevCpus: os.CpuInfo[] = []; // Para cálculo de CPU en Windows
  private globalMetrics = {
    throughput: 0, // MB/s
    cpuLoad: 0,    // %
    memUsage: 0,   // %
    activeHeartbeats: 0, // HB Shield activos
    nodeMemUsage: 0, // Consumo en MB de Node.js
    nodeMemPercent: 0, // Porcentaje de RAM total consumida por Node.js
    lastMemoryReset: Date.now(),
    nextMemoryReset: Date.now() + getCurrentCompactionIntervalMs()
  };

  // Contador público de heartbeats activos (accesible desde proxy-server)
  public heartbeatCount = 0;

  private PING_ENDPOINTS = [
    { host: 'region1.v2.argotunnel.com', port: 7844, label: 'region1.argotunnel' },
    { host: 'region2.v2.argotunnel.com', port: 7844, label: 'region2.argotunnel' },
    { host: 'api.cloudflare.com',         port: 443,  label: 'api.cloudflare.com' },
    { host: 'update.argotunnel.com',      port: 443,  label: 'update.argotunnel' },
  ];

  constructor() {
    super();
    this.setMaxListeners(100); 
    this.prevCpus = os.cpus();
    
    // Throttling de emisión de stats
    setInterval(() => {
      let shouldSync = false;
      if (this.statsPending || this.logsPending || true) { 
        shouldSync = true;
      }

      const now = Date.now();
      const elapsedSec = (now - this.lastSyncTime) / 1000;
      this.lastSyncTime = now;

      const currentTotalBytes = Array.from(this.stats.values()).reduce((acc, s) => acc + s.bytes, 0);
      const deltaBytes = currentTotalBytes - this.lastTotalBytes;
      this.lastTotalBytes = currentTotalBytes;
      this.globalMetrics.throughput = (deltaBytes / (1024 * 1024)) / (elapsedSec || 1);

      // CÁLCULO CPU ROBUSTO (Windows/Linux)
      const currentCpus = os.cpus();
      let totalDiff = 0;
      let idleDiff = 0;
      for (let i = 0; i < currentCpus.length; i++) {
        const prev = this.prevCpus[i]?.times || { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 };
        const curr = currentCpus[i].times;
        
        const pTotal = prev.user + prev.nice + prev.sys + prev.idle + prev.irq;
        const cTotal = curr.user + curr.nice + curr.sys + curr.idle + curr.irq;
        
        totalDiff += (cTotal - pTotal);
        idleDiff += (curr.idle - prev.idle);
      }
      if (totalDiff > 0) {
        this.globalMetrics.cpuLoad = Math.min(100, Math.max(0, 100 * (1 - idleDiff / totalDiff)));
      }
      this.prevCpus = currentCpus;

      // CÁLCULO MEMORIA
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      this.globalMetrics.memUsage = ((totalMem - freeMem) / totalMem) * 100;

      // CÁLCULO MEMORIA NODE Y RESET DATA
      const rssMb = process.memoryUsage().rss / 1024 / 1024;
      this.globalMetrics.nodeMemUsage = rssMb;
      this.globalMetrics.nodeMemPercent = totalMem > 0 ? (process.memoryUsage().rss / totalMem) * 100 : 0;
      this.globalMetrics.lastMemoryReset = getLastCompactionTime();
      this.globalMetrics.nextMemoryReset = getLastCompactionTime() + getCurrentCompactionIntervalMs();

      // HEARTBEAT SHIELD COUNTER
      this.globalMetrics.activeHeartbeats = this.heartbeatCount;

      if (this.statsPending) {
        this.emit("stats", {
          ...Object.fromEntries(this.stats),
          __pings: this.pingStats,
          __metrics: this.globalMetrics
        });
        this.statsPending = false;
      }
      
      this.logsPending = false;

      if (shouldSync && !this.syncInFlight) {
        const payload = {
          stats: {
            ...Object.fromEntries(this.stats),
            __pings: this.pingStats,
            __metrics: this.globalMetrics
          },
          logs: this.recentLogs
        };
        const fp = path.join(process.cwd(), 'data', 'sync.json');
        this.syncInFlight = true;
        fs.writeFile(fp + '.tmp', JSON.stringify(payload), 'utf8', (err) => {
          if (err) { this.syncInFlight = false; return; }
          fs.rename(fp + '.tmp', fp, () => { this.syncInFlight = false; });
        });
      }
    }, 5000);

    this.pingAll();
    setInterval(() => this.pingAll(), 15000);
  }

  private async pingAll() {
    for (const endpoint of this.PING_ENDPOINTS) {
      this.pingEndpoint(endpoint);
    }
    
    const connectors = await getConnectors();
    for (const c of connectors) {
      if (c.isActive) {
        this.pingConnectorHttp(c.id, c.targetUrl);
      }
    }
  }

  private async pingConnectorHttp(id: string, targetUrl: string) {
    const start = Date.now();
    
    const performPing = (url: string): Promise<{ online: boolean; detail: string }> => {
      return new Promise((resolve) => {
        try {
          const urlObj = new URL(url);
          const isHttps = urlObj.protocol === "https:";
          const client = isHttps ? https : http;

          const options: any = {
            method: 'HEAD',
            hostname: urlObj.hostname,
            port: urlObj.port || (isHttps ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            timeout: 5000,
            rejectUnauthorized: false,
            headers: {
              'User-Agent': 'BizGuard-Monitor/1.2',
              'Connection': 'close'
            }
          };

          const req = client.request(options, (res) => {
            // Cualquier respuesta HTTP = servidor vivo (incluso 500)
            const isOnline = (res.statusCode || 0) > 0;
            res.resume();
            resolve({ online: isOnline, detail: `status=${res.statusCode}` });
          });

          req.on('error', (err: any) => {
            resolve({ online: false, detail: `error=${err.code || err.message}` });
          });
          req.on('timeout', () => {
            req.destroy();
            resolve({ online: false, detail: 'timeout' });
          });
          req.end();
        } catch (e: any) {
          resolve({ online: false, detail: `exception=${e.message}` });
        }
      });
    };

    try {
      let isOnline = false;
      let debugInfo = '';
      
      if (targetUrl.startsWith('http')) {
        const result = await performPing(targetUrl);
        isOnline = result.online;
        debugInfo = result.detail;
      } else {
        const httpsResult = await performPing(`https://${targetUrl}`);
        isOnline = httpsResult.online;
        debugInfo = `https:${httpsResult.detail}`;
        if (!isOnline) {
          const httpResult = await performPing(`http://${targetUrl}`);
          isOnline = httpResult.online;
          debugInfo += ` | http:${httpResult.detail}`;
        }
      }

      const latency = Date.now() - start;
      console.log(`[PING-RESULT] ${id} | URL: ${targetUrl} | Online: ${isOnline} | Latency: ${latency}ms | ${debugInfo}`);
      
      const currentStats = this.stats.get(id) || { requests: 0, bytes: 0 };
      
      this.stats.set(id, { 
        ...currentStats, 
        activePing: isOnline ? latency : -1, 
        isOnline 
      });
      this.statsPending = true;
    } catch (e: any) {
      console.log(`[PING-FATAL] ${id} | URL: ${targetUrl} | ${e.message}`);
      const currentStats = this.stats.get(id) || { requests: 0, bytes: 0 };
      this.stats.set(id, { ...currentStats, activePing: -1, isOnline: false });
      this.statsPending = true;
    }
  }

  private pingEndpoint(endpoint: typeof ProxyManager.prototype.PING_ENDPOINTS[0]) {
    const start = Date.now();
    const socket = new net.Socket();
    
    socket.setTimeout(5000);
    
    socket.connect(endpoint.port, endpoint.host, () => {
      const latency = Date.now() - start;
      this.pingStats[endpoint.label] = latency;
      this.statsPending = true;
      socket.destroy();
    });

    socket.on('error', () => {
      this.pingStats[endpoint.label] = -1;
      this.statsPending = true;
      socket.destroy();
    });

    socket.on('timeout', () => {
      this.pingStats[endpoint.label] = -1;
      this.statsPending = true;
      socket.destroy();
    });
  }

  async init() {
    const connectors = await getConnectors();
    const ports = Array.from(new Set(connectors.map(c => c.port)));
    for (const port of ports) {
      this.refreshPort(port);
    }
  }

  getStats(id?: string) {
    if (id) return this.stats.get(id);
    return Object.fromEntries(this.stats);
  }

  private async refreshPort(port: number) {
    const connectors = (await getConnectors()).filter(c => c.port === port);
    
    if (connectors.length === 0) {
      if (this.servers.has(port)) {
        this.servers.get(port)?.close();
        this.servers.delete(port);
      }
      return;
    }

    if (this.servers.has(port)) {
      this.log(`[BIZGUARD] Port ${port} refreshed with ${connectors.length} services (Server kept alive)`, "system");
      return;
    }

    const server = http.createServer(async (req, res) => {
      // Rate limiting — primer chequeo, antes de cualquier operación async.
      // Usa cf-connecting-ip (puesto por Cloudflare Tunnel) como IP real del cliente.
      // IMPORTANTE: solo aplica a requests SIN sesión activa. Usuarios autenticados
      // quedan exentos — una página con 15+ recursos + navegación activa superaría
      // el límite fácilmente. Un atacante con cookie falsa saltea el rate limiter pero
      // falla en verifySession() más adelante (Fix 2) y es redirigido a /login.
      const clientIp = (req.headers['cf-connecting-ip'] as string)
        || (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim()
        || req.socket.remoteAddress || 'unknown';
      const rlCookies = req.headers.cookie || "";
      const hasCookieSession = SESSION_COOKIE_NAMES.some(n => rlCookies.includes(n));
      if (!hasCookieSession && !rateLimiter.check(clientIp)) {
        res.writeHead(429, { 'Content-Type': 'text/plain', 'Retry-After': '60' });
        res.end('Too Many Requests');
        return;
      }

      const url = req.url || "";
      const hostHeader = req.headers.host || "";
      const currentConnectors = (await getConnectors()).filter(c => c.port === port);
      const settings = await getSettings();

      // Rutas internas de BizGuard: solo las rutas exactas del dashboard/auth,
      // NO usar startsWith("/login") a secas porque captura URLs del backend como /loginexterno.aspx
      const urlPath = url.split("?")[0].toLowerCase();
      const isInternalRoute = url.startsWith("/api/auth") ||
        url.startsWith("/api/stats") ||
        url.includes("_next") ||
        url.includes("favicon") ||
        urlPath === "/login" ||
        urlPath.startsWith("/login/");
      if (isInternalRoute) {
        const DASH_ID = "internal-dashboard";
        const isLocalDashboardHost = hostHeader.includes("localhost") || hostHeader.includes("127.0.0.1");
        req.headers["x-forwarded-host"] = hostHeader;
        req.headers["x-forwarded-proto"] = isLocalDashboardHost ? "http" : "https";
        if (!this.proxyServers.has(DASH_ID)) {
          const dashConnector = {
            id: DASH_ID,
            name: "Internal BizGuard Dashboard",
            description: "Maneja autenticación y recursos estáticos internamente",
            port: 3000,
            targetUrl: "http://127.0.0.1:3000",
            publicHost: hostHeader,
            isActive: true
          };
          this.proxyServers.set(DASH_ID, {
            server: createProxyServer(dashConnector, () => {}, 20000),
            connector: dashConnector
          });
        }
        (this.proxyServers.get(DASH_ID)!.server as any).emit("request", req, res);
        return;
      }

      // Identificar conector activo por host público
      const host = hostHeader.split(":")[0] || "";
      const activeConnectors = currentConnectors.filter(c => c.isActive);
      let connector = activeConnectors.find(c => c.publicHost === host);
      if (!connector && activeConnectors.length === 1) {
        connector = activeConnectors[0];
      }

      // Si el conector existe pero está pausado, retornar 503
      if (!connector) {
        const paused = currentConnectors.find(c => c.publicHost === host && !c.isActive);
        if (paused) {
          this.log(`[BIZGUARD] Connector ${paused.id} is paused. Returning 503.`, "info");
          res.writeHead(503, { 'Content-Type': 'text/plain' });
          res.end("BizGuard: Connector is paused.");
          return;
        }
      }

      const isLocalHost = hostHeader.includes("localhost") || hostHeader.includes("127.0.0.1");
      const connectorBypass = connector?.bypassAuth === true;
      const requiresAuth = !settings.bypassAuth && !isLocalHost && !connectorBypass;

      // NTLM siempre necesita sesión para obtener credenciales, aunque bypassAuth esté activo.
      // dynamics-crm implica NTLM aunque isNtlm no esté seteado explícitamente en DB.
      const needsSessionForNtlm = connector?.isNtlm === true || connector?.connectorType === 'dynamics-crm';
      const needsCoreNtlmSession = connector?.connectorType === 'core' && isCoreNtlmPath(url);

      if (requiresAuth || needsSessionForNtlm || needsCoreNtlmSession) {
        try {
          const session = await verifySession(req.headers.cookie || "");
          (req as any).session = session;

          if (!session) {
            // Rutas /api/ no deben iniciar flujo de login — retornan 401.
            if (url.startsWith('/api/') && !url.startsWith('/api/auth')) {
              this.log(`[BIZGUARD-Auth] API route ${url} requires auth. Returning 401.`, "info");
              res.writeHead(401, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Unauthorized' }));
              return;
            }

            const isLocal = hostHeader.includes("localhost") || hostHeader.includes("127.0.0.1");
            const protocol = isLocal ? "http" : "https";
            // Si el conector tiene entryPath y el usuario visita /, usar entryPath como destino post-login
            const targetPath = (url === '/' && connector?.entryPath) ? connector.entryPath : url;
            // callbackUrl debe reflejar el origen exacto con el que entró el usuario.
            // auth.ts puede corregir hosts internos, pero no debe canonizar este valor
            // a publicHost cuando el acceso real fue por localhost.
            const absoluteCallback = `${protocol}://${hostHeader}${targetPath}`;

            if (needsCoreNtlmSession && connector) {
              const coreLoginUrl = `/login/core-ntlm?callbackUrl=${encodeURIComponent(absoluteCallback)}&connectorId=${encodeURIComponent(connector.id)}&domain=${encodeURIComponent(connector.coreNtlmDomain || "")}`;
              this.log(`[BIZGUARD-Auth] No Core NTLM session for ${url}. Redirecting to: ${coreLoginUrl}`, "info");
              res.writeHead(302, { Location: coreLoginUrl });
              res.end();
              return;
            }

            // NTLM sin SSO → formulario de credenciales de red
            const loginUrl = needsSessionForNtlm && !requiresAuth
              ? `/login/ntlm?callbackUrl=${encodeURIComponent(absoluteCallback)}&connectorId=${encodeURIComponent(connector?.id || "")}`
              : `/api/auth/signin?callbackUrl=${encodeURIComponent(absoluteCallback)}`;

            this.log(`[BIZGUARD-Auth] No session for ${url}. Redirecting to: ${loginUrl}`, "info");
            res.writeHead(302, { Location: loginUrl });
            res.end();
            return;
          }

          if (needsCoreNtlmSession && connector && !hasCoreNtlmSessionForConnector(session, connector.id)) {
            const isLocal = hostHeader.includes("localhost") || hostHeader.includes("127.0.0.1");
            const protocol = isLocal ? "http" : "https";
            const absoluteCallback = `${protocol}://${hostHeader}${url}`;
            const coreLoginUrl = `/login/core-ntlm?callbackUrl=${encodeURIComponent(absoluteCallback)}&connectorId=${encodeURIComponent(connector.id)}&domain=${encodeURIComponent(connector.coreNtlmDomain || "")}`;
            this.log(`[BIZGUARD-Auth] Core NTLM session missing or belongs to another connector for ${url}. Redirecting to: ${coreLoginUrl}`, "info");
            res.writeHead(302, { Location: coreLoginUrl });
            res.end();
            return;
          }

          // Sesión SSO activa pero NTLM también requerido y sin credenciales CRM → pedir NTLM
          if (needsSessionForNtlm && (!session.crmUser || session.crmConnectorId !== connector?.id)) {
            if (!url.startsWith('/api/') || url.startsWith('/api/auth')) {
              const isLocal = hostHeader.includes("localhost") || hostHeader.includes("127.0.0.1");
              const protocol = isLocal ? "http" : "https";
              const targetPath = (url === '/' && connector?.entryPath) ? connector.entryPath : url;
              const absoluteCallback = `${protocol}://${hostHeader}${targetPath}`;
              const ntlmUrl = `/login/ntlm?callbackUrl=${encodeURIComponent(absoluteCallback)}&connectorId=${encodeURIComponent(connector?.id || "")}`;
              this.log(`[BIZGUARD-Auth] SSO ok but NTLM credentials missing or bound to another connector for ${url}. Redirecting to: ${ntlmUrl}`, "info");
              res.writeHead(302, { Location: ntlmUrl });
              res.end();
              return;
            }
          }

          // Con sesión activa: si el usuario visita / y el conector tiene entryPath, redirigir
          if (url === '/' && connector?.entryPath && session) {
            res.writeHead(302, { Location: connector.entryPath });
            res.end();
            return;
          }
        } catch (e) {
          this.log(`[BIZGUARD-Auth] Critical failure: ${e}`, "error");
          res.writeHead(502);
          res.end("BizGuard Authorization Error");
          return;
        }
      }

      if (!connector) {
        this.log(`[BIZGUARD] No service found for host: ${host} on port ${port}`, "error");
        res.writeHead(404);
        res.end("BizGuard Gateway Error: Host not configured on this port.");
        return;
      }

      this.handleRequest(connector, req, res, (req as any).session, settings);
    });

    server.on('error', (e: any) => {
      this.servers.delete(port); // Limpiar para permitir reintento
      if (e.code === 'EADDRINUSE') {
        this.log(`[BIZGUARD] Port ${port} is already in use by another process. Skipping bind.`, "system");
      } else {
        this.log(`[BIZGUARD Error] Port ${port}: ${e.message}`, "error");
      }
    });

    this.servers.set(port, server); // Registrar antes del listen para bloquear intentos concurrentes
    server.listen(port, "0.0.0.0", () => {
      this.log(`[BIZGUARD] Port ${port} listening for ${connectors.length} services`, "system");
    });

    // WebSocket proxy: tunelizar upgrade requests (SignalR WebSocket transport, etc.)
    server.on('upgrade', async (req: http.IncomingMessage, socket: net.Socket, head: Buffer) => {
      const hostHeader = req.headers.host || "";
      const host = hostHeader.split(":")[0];
      const currentConnectors = (await getConnectors()).filter(c => c.port === port);
      const activeConnectors = currentConnectors.filter(c => c.isActive);
      let connector = activeConnectors.find(c => c.publicHost === host);
      if (!connector && activeConnectors.length === 1) connector = activeConnectors[0];

      if (!connector) {
        socket.write('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n');
        socket.destroy();
        return;
      }

      // Auth check — WebSocket no puede recibir redirección, retorna 401
      const settings = await getSettings();
      const isLocalHost = hostHeader.includes("localhost") || hostHeader.includes("127.0.0.1");
      const connectorBypass = connector.bypassAuth === true;
      const requiresAuth = !settings.bypassAuth && !isLocalHost && !connectorBypass;

      if (requiresAuth) {
        try {
          const session = await verifySession(req.headers.cookie || "");
          if (!session) {
            socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
            socket.destroy();
            return;
          }
        } catch {
          socket.write('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n');
          socket.destroy();
          return;
        }
      }

      const targetUrl = new URL(connector.targetUrl);
      const isHttps = targetUrl.protocol === "https:";
      const targetPort = targetUrl.port ? parseInt(targetUrl.port) : (isHttps ? 443 : 80);
      const targetHost = targetUrl.hostname;

      // Reconstruir headers para backend (limpiar cf-* y x-forwarded-*)
      const fwdHeaders: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        if (!k.startsWith('cf-') && !k.startsWith('x-forwarded-')) {
          fwdHeaders[k] = Array.isArray(v) ? v.join(', ') : (v || '');
        }
      }
      fwdHeaders['host'] = targetUrl.host;
      fwdHeaders['x-forwarded-host'] = hostHeader;
      fwdHeaders['x-forwarded-proto'] = 'https';
      fwdHeaders['x-forwarded-for'] = ((req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1').split(',')[0].trim();

      // Armar request HTTP de upgrade para enviar al backend
      let upgradeReq = `${req.method} ${req.url} HTTP/1.1\r\n`;
      for (const [k, v] of Object.entries(fwdHeaders)) {
        upgradeReq += `${k}: ${v}\r\n`;
      }
      upgradeReq += '\r\n';

      // Crear socket TCP/TLS hacia el backend
      const backendSocket: net.Socket = isHttps
        ? tls.connect({ host: targetHost, port: targetPort, servername: targetHost, rejectUnauthorized: connector.strictTls === true })
        : net.connect({ host: targetHost, port: targetPort });

      const onReady = isHttps ? 'secureConnect' : 'connect';

      backendSocket.once(onReady, () => {
        backendSocket.write(upgradeReq);
        if (head && head.length > 0) backendSocket.write(head);
        // Tunel bidireccional
        backendSocket.pipe(socket);
        socket.pipe(backendSocket);
        this.log(`[WS-PROXY] Conectado: ${req.url} -> ${connector!.id}`, 'info');
      });

      backendSocket.on('error', (err: Error) => {
        // ECONNRESET/EPIPE/ECONNREFUSED son cierres normales de SignalR/WebSocket
        // (el servidor resetea conexiones inactivas y el cliente reconecta solo).
        // No loguear como error para evitar falsa alarma.
        const code = (err as any).code || '';
        const isExpectedClose = code === 'ECONNRESET' || code === 'EPIPE' || code === 'ECONNREFUSED';
        if (!isExpectedClose) {
          this.log(`[WS-PROXY] Error backend: ${err.message} (${connector!.id})`, 'error');
        }
        if (!socket.destroyed) socket.destroy();
      });

      socket.on('error', () => {
        if (!backendSocket.destroyed) backendSocket.destroy();
      });

      backendSocket.on('close', () => {
        if (!socket.destroyed) socket.destroy();
      });
      socket.on('close', () => {
        if (!backendSocket.destroyed) backendSocket.destroy();
      });
    });

    this.servers.set(port, server);
  }

  private handleRequest(connector: Connector, req: http.IncomingMessage, res: http.ServerResponse, _session: any, settings: GlobalSettings) {
    if (!this.stats.has(connector.id)) {
      this.stats.set(connector.id, { requests: 0, bytes: 0, latency: 0 });
    }

    const stats = this.stats.get(connector.id)!;
    stats.requests++;
    this.statsPending = true;

    try {
      // Reusar el mismo proxy server (y su http.Agent keepAlive) por conector.
      // Crear uno nuevo por request acumula agentes con sockets abiertos → OOM.
      // Calcular el umbral de heartbeat (conector -> global settings -> fallback 20s)
      const resolvedFirstPulseSec = connector.hbFirstPulse !== undefined && connector.hbFirstPulse > 0
        ? connector.hbFirstPulse
        : settings.hbFirstPulse !== undefined && settings.hbFirstPulse > 0
          ? settings.hbFirstPulse
          : 20;
      const hbFirstPulseMs = resolvedFirstPulseSec * 1000;

      // Si la configuración crítica del conector cambió (e.g. se activó HAR log o cambió el umbral), recreamos en caliente.
      const cached = this.proxyServers.get(connector.id);
      const hasChanged = cached && (
        cached.connector.targetUrl !== connector.targetUrl ||
        cached.connector.publicHost !== connector.publicHost ||
        cached.connector.port !== connector.port ||
        cached.connector.bypassAuth !== connector.bypassAuth ||
        cached.connector.strictTls !== connector.strictTls ||
        cached.connector.connectorType !== connector.connectorType ||
        cached.connector.isNtlm !== connector.isNtlm ||
        cached.connector.ntlmDomain !== connector.ntlmDomain ||
        cached.connector.coreNtlmDomain !== connector.coreNtlmDomain ||
        cached.connector.entryPath !== connector.entryPath ||
        cached.connector.harLog !== connector.harLog ||
        cached.connector.trafficLog !== connector.trafficLog ||
        cached.connector.hbFirstPulse !== connector.hbFirstPulse
      );

      if (!cached || hasChanged) {
        if (cached) {
          this.log(`[BIZGUARD] Configuración de ${connector.id} cambió. Recreando proxy server.`, "system");
        }
        const server = createProxyServer(connector, (id, bytes, latency) => {
          const current = this.stats.get(id) || { requests: 0, bytes: 0, latency: 0 };
          if (bytes > 0) current.bytes += bytes;
          if (latency !== undefined) current.latency = latency;
          this.stats.set(id, { ...current });
          this.statsPending = true;
        }, hbFirstPulseMs);
        this.proxyServers.set(connector.id, { server, connector });
      }
      const proxyServer = this.proxyServers.get(connector.id)!.server;

      this.log(`[BIZGUARD-IN] ${req.method} ${req.url} -> ${connector.id}`, "info");
      (proxyServer as any).emit('request', req, res);

    } catch (error) {
      this.log(`[BIZGUARD Error] Proxy failed for ${connector.id}: ${error}`, "error");
      if (!res.headersSent) {
        res.writeHead(502);
        res.end("BizGuard Proxy Error");
      }
    }
  }

  log(message: string, type: "info" | "error" | "system" = "info") {
    const logEntry = {
      timestamp: new Date().toLocaleTimeString(),
      message,
      type
    };
    
    this.recentLogs.push(logEntry);
    if (this.recentLogs.length > 200) this.recentLogs.shift();
    this.logsPending = true;
    
    this.emit("log", logEntry);
    console.log(`[${logEntry.timestamp}] ${message}`);
  }

  async startConnector(connector: Connector) {
    // Invalidar cache para que los cambios de config surtan efecto
    this.proxyServers.delete(connector.id);
    await this.refreshPort(connector.port);
  }

  stopConnector(id: string) {
    this.proxyServers.delete(id);
    getConnectors().then(connectors => {
      const conn = connectors.find(c => c.id === id);
      if (conn) this.refreshPort(conn.port);
    });
  }
}

export const proxyManager = global.proxyManager || new ProxyManager();
global.proxyManager = proxyManager;

export default proxyManager;
