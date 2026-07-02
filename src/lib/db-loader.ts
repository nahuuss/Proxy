import Datastore from '@seald-io/nedb';

import { isProtectedDbPhase } from './db-runtime-phase';

export async function loadWithRetry(
  db: Datastore<unknown>,
  name: string,
  retries = 3,
  delay = 500
): Promise<void> {
  if (isProtectedDbPhase()) {
    console.log(`[NeDB] Skipped loading ${name} during protected phase.`);
    return;
  }

  for (let i = 0; i < retries; i++) {
    try {
      await db.loadDatabaseAsync();
      return;
    } catch (error: unknown) {
      const dbError = error as { code?: string; path?: string };
      if (dbError.code === 'ENOENT' && dbError.path?.endsWith('.db~')) {
        console.warn(
          `[NeDB] Colisión al cargar ${name} (intento ${i + 1}/${retries}). Reintentando en ${delay}ms...`
        );
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.warn(`[NeDB] Se agotaron reintentos para ${name}. Ignorando ENOENT inofensivo.`);
        }
      } else {
        console.error(`[NeDB Error] ${name}:`, error);
        break;
      }
    }
  }
}
