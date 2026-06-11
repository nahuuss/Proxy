import fs from 'fs';
import path from 'path';

// ─── Configuración ────────────────────────────────────────────────────────────
const TRAFFIC_DIR = path.join(process.cwd(), 'logs', 'traffic');
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB por chunk
const DEFAULT_RETENTION_MS = 5 * 60 * 60 * 1000; // 5 horas por defecto
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // cada 10 minutos

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface TrafficEntry {
  type?: 'traffic';
  ts: string;
  elapsed: number;
  ttfb?: number; // Solo flujo estándar — ausente en NTLM
  user: string;
  conn: string;
  method: string;
  url: string;
  status: number;
  reqSize: number;
  resSize: number;
  ct: string;
  xhr: boolean;
  err: string | null;
  cookies: string[];
  reqHdrs: Record<string, string | string[] | undefined>;
  resHdrs: Record<string, string | string[] | undefined>;
}

export interface DebugEntry {
  type: 'debug';
  ts: string;
  user: string;
  conn: string;
  tag: string;
  method?: string;
  path?: string;
  status?: number | string;
  elapsedMs?: number;
  extra?: string;
}

export type LogEntry = TrafficEntry | DebugEntry;

// ─── Estado interno por conector ───────────────────────────────────────────────
interface ConnectorFileState {
  fd: number;
  filePath: string;
  currentSize: number;
  chunkNumber: number;
  datePrefix: string; // YYYY-MM-DD_HHmm
}

// ─── Utilidades ───────────────────────────────────────────────────────────────

/** Sanitiza el identificador de conector para usarlo como carpeta del filesystem */
function sanitizeFolderName(raw: string): string {
  return raw
    .replace(/[@\\/:\s]+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .slice(0, 64)
    .toLowerCase() || 'unknown';
}

/** Genera el prefijo de fecha para nombres de archivo: YYYY-MM-DD_HHmm */
function datePrefix(): string {
  const now = new Date();
  const pad2 = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}_${pad2(now.getHours())}${pad2(now.getMinutes())}`;
}

/** Extrae solo los nombres de las cookies del header Cookie */
function extractCookieNames(cookieHeader?: string | string[]): string[] {
  if (!cookieHeader) return [];
  const raw = Array.isArray(cookieHeader) ? cookieHeader.join('; ') : cookieHeader;
  return raw.split(';')
    .map(p => {
      const idx = p.indexOf('=');
      return idx > 0 ? p.slice(0, idx).trim() : null;
    })
    .filter(Boolean) as string[];
}

/** Calcula el tiempo de retención en milisegundos */
function calculateRetentionMs(value?: number, unit?: string): number {
  if (value === undefined || value === null || !unit) {
    return DEFAULT_RETENTION_MS;
  }
  switch (unit) {
    case 'seconds': return value * 1000;
    case 'minutes': return value * 60 * 1000;
    case 'hours': return value * 60 * 60 * 1000;
    case 'days': return value * 24 * 60 * 60 * 1000;
    default: return DEFAULT_RETENTION_MS;
  }
}

// ─── Clase TrafficLogger (Singleton) ──────────────────────────────────────────

class TrafficLogger {
  private connectorFiles = new Map<string, ConnectorFileState>();
  private dirEnsured = false;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanupTimer();
  }

  /**
   * Loguea una entrada de tráfico de forma no bloqueante.
   * Agrupa los logs bajo una carpeta por cada connectorId (entry.conn).
   */
  log(entry: LogEntry): void {
    if (!entry.conn) return;

    try {
      this.ensureBaseDir();
      const connectorId = sanitizeFolderName(entry.conn);
      const line = JSON.stringify(entry) + '\n';
      const buf = Buffer.from(line, 'utf8');

      const state = this.getOrCreateFileState(connectorId);
      if (!state) return; // Error al abrir archivo, ya logueado

      // Rotación si supera MAX_FILE_SIZE
      if (state.currentSize + buf.length > MAX_FILE_SIZE) {
        this.rotateFile(connectorId, state);
      }

      const currentState = this.connectorFiles.get(connectorId)!;
      fs.write(currentState.fd, buf, 0, buf.length, null, (err) => {
        if (err) {
          console.error(`[TRAFFIC-LOG-ERR] Error escribiendo para conector ${connectorId}:`, err.message);
          // Cerrar fd corrupto y forzar re-apertura
          try { fs.closeSync(currentState.fd); } catch {}
          this.connectorFiles.delete(connectorId);
        } else {
          currentState.currentSize += buf.length;
        }
      });

    } catch (error: any) {
      console.error(`[TRAFFIC-LOG-FATAL] Excepción en log():`, error.message);
    }
  }

  /** Asegura que el directorio base exista (una sola vez) */
  private ensureBaseDir(): void {
    if (this.dirEnsured) return;
    if (!fs.existsSync(TRAFFIC_DIR)) {
      fs.mkdirSync(TRAFFIC_DIR, { recursive: true });
    }
    this.dirEnsured = true;
  }

  /** Obtiene o crea el descriptor de archivo para un conector */
  private getOrCreateFileState(connectorId: string): ConnectorFileState | null {
    const existing = this.connectorFiles.get(connectorId);
    if (existing) return existing;

    try {
      const connDir = path.join(TRAFFIC_DIR, connectorId);
      if (!fs.existsSync(connDir)) {
        fs.mkdirSync(connDir, { recursive: true });
      }

      const dp = datePrefix();
      const chunkNumber = 1;
      const filePath = path.join(connDir, `${dp}-${chunkNumber}.jsonl`);
      const fd = fs.openSync(filePath, 'a');
      let currentSize = 0;
      try {
        currentSize = fs.fstatSync(fd).size;
      } catch {}

      const state: ConnectorFileState = { fd, filePath, currentSize, chunkNumber, datePrefix: dp };
      this.connectorFiles.set(connectorId, state);
      return state;
    } catch (error: any) {
      console.error(`[TRAFFIC-LOG-ERR] No se pudo abrir archivo para conector ${connectorId}:`, error.message);
      return null;
    }
  }

  /** Rota el archivo del conector: cierra el actual y abre el siguiente chunk */
  private rotateFile(connectorId: string, oldState: ConnectorFileState): void {
    try {
      fs.closeSync(oldState.fd);
    } catch {}

    const connDir = path.join(TRAFFIC_DIR, connectorId);
    const dp = datePrefix();
    const newChunk = oldState.datePrefix === dp ? oldState.chunkNumber + 1 : 1;
    const newPath = path.join(connDir, `${dp}-${newChunk}.jsonl`);

    try {
      const fd = fs.openSync(newPath, 'a');
      const newState: ConnectorFileState = {
        fd,
        filePath: newPath,
        currentSize: 0,
        chunkNumber: newChunk,
        datePrefix: dp,
      };
      this.connectorFiles.set(connectorId, newState);
    } catch (error: any) {
      console.error(`[TRAFFIC-LOG-ERR] Error al rotar archivo para conector ${connectorId}:`, error.message);
      this.connectorFiles.delete(connectorId);
    }
  }

  /** Timer de limpieza cada 10 minutos */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, CLEANUP_INTERVAL_MS);
    this.cleanupTimer.unref(); // No evitar que el proceso termine
  }

  /** Ejecuta la limpieza de archivos antiguos utilizando retención configurable por conector */
  private async cleanup(): Promise<void> {
    try {
      if (!fs.existsSync(TRAFFIC_DIR)) return;

      // Importar dinámicamente para evitar problemas de ciclo de carga en Next.js
      const { getConnectors } = await import('./connectors');
      const connectors = await getConnectors();
      const connectorMap = new Map(connectors.map(c => [c.id, c]));

      const connDirs = fs.readdirSync(TRAFFIC_DIR, { withFileTypes: true })
        .filter(d => d.isDirectory());

      for (const dir of connDirs) {
        const connectorId = dir.name;
        const connDirPath = path.join(TRAFFIC_DIR, connectorId);
        
        // Obtener la configuración del conector correspondiente
        const conn = connectorMap.get(connectorId);
        const retentionMs = calculateRetentionMs(conn?.trafficRetentionValue, conn?.trafficRetentionUnit);
        const cutoff = Date.now() - retentionMs;

        const files = fs.readdirSync(connDirPath);

        for (const file of files) {
          const filePath = path.join(connDirPath, file);
          try {
            const stat = fs.statSync(filePath);
            if (stat.mtimeMs < cutoff) {
              // Cerrar fd si lo tenemos abierto para este conector y es este archivo
              const state = this.connectorFiles.get(connectorId);
              if (state && state.filePath === filePath) {
                try { fs.closeSync(state.fd); } catch {}
                this.connectorFiles.delete(connectorId);
              }
              fs.unlinkSync(filePath);
            }
          } catch {}
        }

        // Si la carpeta quedó vacía, eliminarla
        try {
          const remaining = fs.readdirSync(connDirPath);
          if (remaining.length === 0) {
            fs.rmdirSync(connDirPath);
          }
        } catch {}
      }
    } catch (error: any) {
      console.error(`[TRAFFIC-LOG-CLEANUP] Error durante limpieza:`, error.message);
    }
  }

  /** Cierra todos los descriptores abiertos (para shutdown limpio) */
  shutdown(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    for (const [, state] of this.connectorFiles) {
      try { fs.closeSync(state.fd); } catch {}
    }
    this.connectorFiles.clear();
  }
}

// ─── Singleton global ─────────────────────────────────────────────────────────
const globalForTraffic = globalThis as typeof globalThis & { _trafficLogger?: TrafficLogger };
if (!globalForTraffic._trafficLogger) {
  globalForTraffic._trafficLogger = new TrafficLogger();
}
export const trafficLogger = globalForTraffic._trafficLogger;
export { extractCookieNames };
