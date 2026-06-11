import fs from 'fs';
import path from 'path';

const LOGS_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOGS_DIR, 'sso.log');

export function logSSO(message: string, data?: any) {
  const timestamp = new Date().toLocaleString();
  const dataStr = data ? ` | Data: ${JSON.stringify(data)}` : '';
  const logEntry = `[${timestamp}] ${message}${dataStr}\n`;

  try {
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    }
    fs.appendFileSync(LOG_FILE, logEntry);
  } catch (err) {
    console.error('Failed to write to sso.log:', err);
  }
}
