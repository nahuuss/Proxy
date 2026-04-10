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
