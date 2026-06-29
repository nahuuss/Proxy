import fs from 'fs';
import path from 'path';
import { getConnectorById } from './connectors';

const LOGS_DIR = path.join(process.cwd(), 'logs');

/**
 * Loguea exclusivamente información relacionada con el Heartbeat y Background Jobs
 * en un archivo de log específico por conector diario.
 */
export function logHB(connectorId: string | undefined, message: string) {
  const timestamp = new Date().toLocaleString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  
  const logLine = `[${timestamp}] ${message}\n`;
  
  // Imprimir en consola siempre para visibilidad inmediata en el dashboard
  console.log(message);
  
  const connId = connectorId || 'global';
  
  const writeLog = () => {
    try {
      const connDir = path.join(LOGS_DIR, 'hb', connId);
      if (!fs.existsSync(connDir)) {
        fs.mkdirSync(connDir, { recursive: true });
      }
      const dp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const logFile = path.join(connDir, `${dp}.log`);
      
      fs.appendFile(logFile, logLine, 'utf8', (err) => {
        if (err) console.error(`[Error de Log] No se pudo escribir en hb.log para ${connId}:`, err);
      });
    } catch (err) {
      console.error(`[Error de Log] No se pudo crear directorio de hb para ${connId}:`, err);
    }
  };

  if (connId === 'global') {
    writeLog();
  } else {
    getConnectorById(connId).then(conn => {
      // Si el conector tiene habilitado hbLog, escribimos el log
      if (conn && conn.hbLog) {
        writeLog();
      }
    }).catch(err => {
      console.error('Error fetching connector for HB log verification:', err);
    });
  }
}
