import fs from 'fs';
import path from 'path';

const LOG_FILE = path.join(process.cwd(), 'hb.log');

/**
 * Loguea exclusivamente información relacionada con el Heartbeat y Background Jobs
 * en el archivo hb.log para facilitar el debugging sin ruido.
 */
export function logHB(message: string) {
  const timestamp = new Date().toLocaleString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  
  const logLine = `[${timestamp}] ${message}\n`;
  
  // Imprimir en consola también para visibilidad inmediata en el dashboard
  console.log(message);
  
  // Append al archivo
  try {
    fs.appendFileSync(LOG_FILE, logLine, 'utf8');
  } catch (err) {
    console.error(`[Error de Log] No se pudo escribir en hb.log:`, err);
  }
}

/**
 * Log de debug por conector — solo se escribe si el conector tiene debugLog: true.
 * Escribe en /debug-{connectorId}.log en la raíz del proyecto.
 * Formato: timestamp | method | path | status | elapsed | extra
 * 
 * @param connectorId  ID del conector
 * @param debugEnabled Valor de connector.debugLog — si false, no hace nada
 * @param fields       Campos estructurados a loguear (separados por tab)
 */
export function logDebug(
  connectorId: string,
  debugEnabled: boolean | undefined,
  fields: {
    tag: string;          // Etiqueta de la entrada ej: "[PROXY]", "[HB-START]"
    method?: string;
    path?: string;
    status?: number | string;
    elapsedMs?: number;
    extra?: string;
  }
) {
  if (!debugEnabled) return;

  const debugFile = path.join(process.cwd(), `debug-${connectorId}.log`);

  const now = new Date();
  const timestamp = now.toLocaleString('es-AR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  });

  // Columnas separadas por tab para fácil análisis en Excel/grep
  const cols = [
    timestamp,
    fields.tag.padEnd(20),
    (fields.method || '-').padEnd(6),
    (fields.path || '-').substring(0, 80).padEnd(80),
    String(fields.status ?? '-').padEnd(6),
    fields.elapsedMs !== undefined ? `${fields.elapsedMs}ms`.padEnd(10) : '-'.padEnd(10),
    fields.extra || '',
  ];

  const logLine = cols.join('\t') + '\n';

  try {
    fs.appendFileSync(debugFile, logLine, 'utf8');
  } catch (err) {
    console.error(`[Debug-Log] No se pudo escribir en ${debugFile}:`, err);
  }
}
