import fs from 'fs';
import path from 'path';

const LOG_FILE = path.join(process.cwd(), 'sso.log');

export function logSSO(message: string, data?: any) {
  const timestamp = new Date().toLocaleString();
  const dataStr = data ? ` | Data: ${JSON.stringify(data)}` : '';
  const logEntry = `[${timestamp}] ${message}${dataStr}\n`;

  try {
    fs.appendFileSync(LOG_FILE, logEntry);
  } catch (err) {
    console.error('Failed to write to sso.log:', err);
  }
}
