import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { operationalLogger } from '../../lib/operational-logger.js';

export function readJsonFileSafe<T>(filePath: string): T | null {
  try {
    const raw = readFileSync(filePath, 'utf8');
    if (!raw.trim()) return null;
    return JSON.parse(raw) as T;
  } catch (error: any) {
    if (error?.code === 'ENOENT') return null;
    operationalLogger.warn('read_models.runtime_json_file.read_failed', {
      module: 'services.read-models.runtime-json-file',
      file_path: filePath,
      error_message: String(error?.message || error),
    });
    return null;
  }
}

export function writeJsonFileAtomic(filePath: string, data: unknown): void {
  const dir = dirname(filePath);
  mkdirSync(dir, { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  const payload = JSON.stringify(data);
  writeFileSync(tmpPath, payload, 'utf8');
  renameSync(tmpPath, filePath);
}
