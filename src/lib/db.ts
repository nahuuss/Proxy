import Datastore from '@seald-io/nedb';
import path from 'path';
import fs from 'fs';

// Asegurarse de que el directorio de datos existe
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Asegurar que los archivos .db existen (evita ENOENT en rename)
['connectors.db', 'metrics.db', 'settings.db'].forEach(f => {
  const fp = path.join(DATA_DIR, f);
  if (!fs.existsSync(fp)) {
    fs.writeFileSync(fp, '', { encoding: 'utf8' });
  }
});

declare global {
  var connectorsDb: Datastore<any> | undefined;
  var metricsDb: Datastore<any> | undefined;
  var settingsDb: Datastore<any> | undefined;
  var lastCompactionTime: number | undefined;
  var currentCompactionIntervalMs: number | undefined;
}

// Determinar de forma robusta si estamos en fase de compilación (next build o workers)
export function isBuildPhase(): boolean {
  if (process.env.npm_lifecycle_event === 'build') return true;
  if (process.env.NEXT_PHASE === 'phase-production-build') return true;
  if (typeof process !== 'undefined' && process.argv) {
    if (process.argv.some(arg => arg.includes('build') || arg.includes('next-build'))) return true;
  }
  return false;
}

// Función utilitaria para cargar base de datos con reintentos
async function loadWithRetry(db: Datastore<any>, name: string, retries = 3, delay = 500) {
  // Evitar cargar NeDB y generar archivos .db~ durante la etapa de compilación
  if (isBuildPhase()) {
    console.log(`[NeDB] Skipped loading ${name} during Next.js build phase.`);
    return;
  }

  for (let i = 0; i < retries; i++) {
    try {
      await db.loadDatabaseAsync();
      return; // Éxito
    } catch (e: any) {
      if (e.code === 'ENOENT' && e.path?.endsWith('.db~')) {
        console.warn(`[NeDB] Colisión al cargar ${name} (intento ${i + 1}/${retries}). Reintentando en ${delay}ms...`);
        if (i < retries - 1) {
          await new Promise(res => setTimeout(res, delay));
        } else {
          console.warn(`[NeDB] Se agotaron reintentos para ${name}. Ignorando ENOENT inofensivo.`);
        }
      } else {
        console.error(`[NeDB Error] ${name}:`, e);
        break; // Error real, no reintentar
      }
    }
  }
}

export const connectorsDb = global.connectorsDb || new Datastore({
  filename: path.join(DATA_DIR, 'connectors.db'),
  autoload: false
});
loadWithRetry(connectorsDb, 'connectors.db');

export const metricsDb = global.metricsDb || new Datastore({
  filename: path.join(DATA_DIR, 'metrics.db'),
  autoload: false
});
loadWithRetry(metricsDb, 'metrics.db');

// Singleton para Configuración Global
export const settingsDb = global.settingsDb || new Datastore({
  filename: path.join(DATA_DIR, 'settings.db'),
  autoload: false
});
loadWithRetry(settingsDb, 'settings.db');

export const DEFAULT_COMPACT_INTERVAL_MS = parseInt(process.env.MEMORY_RESET_INTERVAL_MINUTES || '30') * 60 * 1000;

if (!global.lastCompactionTime) {
  global.lastCompactionTime = Date.now();
}

if (!global.currentCompactionIntervalMs) {
  global.currentCompactionIntervalMs = DEFAULT_COMPACT_INTERVAL_MS;
}

export function getLastCompactionTime(): number {
  return global.lastCompactionTime || Date.now();
}

export function getCurrentCompactionIntervalMs(): number {
  return global.currentCompactionIntervalMs || DEFAULT_COMPACT_INTERVAL_MS;
}

async function resolveCompactionIntervalMs(): Promise<number> {
  if (isBuildPhase()) return DEFAULT_COMPACT_INTERVAL_MS;

  try { await settingsDb.loadDatabaseAsync(); } catch (e) {}
  const settings = await settingsDb.findOneAsync({ id: "global_settings" });
  const rawMinutes = Number((settings as any)?.memoryResetIntervalMinutes);

  if (Number.isFinite(rawMinutes) && rawMinutes > 0) {
    return rawMinutes * 60 * 1000;
  }

  return DEFAULT_COMPACT_INTERVAL_MS;
}

export async function forceMemoryReset() {
  if (isBuildPhase()) return;

  console.log('[NeDB-Compact] Iniciando compactación manual de base de datos y liberación de memoria...');
  await Promise.all([
    connectorsDb.compactDatafileAsync().catch(err => console.error('[NeDB-Compact] connectors.db error:', err)),
    metricsDb.compactDatafileAsync().catch(err => console.error('[NeDB-Compact] metrics.db error:', err)),
    settingsDb.compactDatafileAsync().catch(err => console.error('[NeDB-Compact] settings.db error:', err))
  ]);

  if (global && typeof global.gc === 'function') {
    try {
      console.log('[NeDB-Compact] Forzando recolección de basura (gc)...');
      global.gc();
    } catch (e) {}
  }
  
  global.lastCompactionTime = Date.now();
  await scheduleNextCompaction();
}

let compactionTimeout: NodeJS.Timeout | null = null;
export async function scheduleNextCompaction() {
  if (isBuildPhase()) return;
  if (compactionTimeout) {
    clearTimeout(compactionTimeout);
  }
  const intervalMs = await resolveCompactionIntervalMs();
  global.currentCompactionIntervalMs = intervalMs;
  compactionTimeout = setTimeout(async () => {
    await forceMemoryReset();
  }, intervalMs);
  compactionTimeout.unref();
}

export async function rescheduleMemoryResetSchedule() {
  await scheduleNextCompaction();
}

// Configurar compactación periódica manual cada 30 minutos para liberar memoria si no es etapa de compilación
if (!isBuildPhase()) {
  void scheduleNextCompaction();
}

if (process.env.NODE_ENV !== 'production') {
  global.connectorsDb = connectorsDb;
  global.metricsDb = metricsDb;
  global.settingsDb = settingsDb;
}
