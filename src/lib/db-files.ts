import fs from 'fs';
import path from 'path';

const DB_FILENAMES = ['connectors.db', 'metrics.db', 'settings.db'] as const;

export const DATA_DIR = path.join(process.cwd(), 'data');

export function ensureDbStorage(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  for (const filename of DB_FILENAMES) {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, '', { encoding: 'utf8' });
    }
  }
}

export function resolveDbFilePath(filename: (typeof DB_FILENAMES)[number]): string {
  return path.join(DATA_DIR, filename);
}
