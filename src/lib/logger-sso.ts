import fs from 'fs';
import path from 'path';
import { getConnectorById } from './connectors';

const LOGS_DIR = path.join(process.cwd(), 'logs');

export function logSSO(connectorId: string | undefined, message: string, data?: any) {
  const connId = connectorId || 'global';
  
  const writeLog = () => {
    const timestamp = new Date().toLocaleString();
    const dataStr = data ? ` | Data: ${JSON.stringify(data)}` : '';
    const logEntry = `[${timestamp}] ${message}${dataStr}\n`;
    const dp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const connDir = path.join(LOGS_DIR, 'sso', connId);

    try {
      if (!fs.existsSync(connDir)) {
        fs.mkdirSync(connDir, { recursive: true });
      }
      const logFile = path.join(connDir, `${dp}.log`);
      fs.appendFile(logFile, logEntry, 'utf8', (err) => {
        if (err) console.error(`Failed to write to SSO log for ${connId}:`, err);
      });
    } catch (err) {
      console.error(`Failed to create directory for SSO log:`, err);
    }
  };

  if (connId === 'global') {
    writeLog();
  } else {
    getConnectorById(connId).then(conn => {
      // Si el conector tiene habilitado ssoLog, escribimos el log
      if (conn && conn.ssoLog) {
        writeLog();
      }
    }).catch(err => {
      console.error('Error fetching connector for SSO log verification:', err);
    });
  }
}
