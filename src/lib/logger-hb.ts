import fs from 'fs';
import path from 'path';

const LOGS_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOGS_DIR, 'hb.log');

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
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    }
    fs.appendFileSync(LOG_FILE, logLine, 'utf8');
  } catch (err) {
    console.error(`[Error de Log] No se pudo escribir en hb.log:`, err);
  }
}


