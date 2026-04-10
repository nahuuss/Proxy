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
}

// Función utilitaria para cargar base de datos con reintentos
async function loadWithRetry(db: Datastore<any>, name: string, retries = 3, delay = 500) {
  // Evitar cargar NeDB y generar archivos .db~ durante la etapa de compilación
  if (process.env.npm_lifecycle_event === 'build') {
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

if (process.env.NODE_ENV !== 'production') {
  global.connectorsDb = connectorsDb;
  global.metricsDb = metricsDb;
  global.settingsDb = settingsDb;
}
