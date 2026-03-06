import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { operationalLogger } from '../../lib/operational-logger.js';

function readErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('code' in error)) return null;
  const code = error.code;
  return typeof code === 'string' ? code : null;
}

function readErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object' || !('message' in error)) {
    return String(error || 'unknown');
  }
  const message = error.message;
  return typeof message === 'string' && message.trim() ? message : String(error || 'unknown');
}

export function readJsonFileSafe<T>(filePath: string): T | null {
  try {
    const raw = readFileSync(filePath, 'utf8');
    if (!raw.trim()) return null;
    return JSON.parse(raw) as T;
  } catch (error: unknown) {
    if (readErrorCode(error) === 'ENOENT') return null;
    operationalLogger.warn('read_models.runtime_json_file.read_failed', {
      module: 'services.read-models.runtime-json-file',
      file_path: filePath,
      error_message: readErrorMessage(error),
    });
    return null;
  }
}

export function writeJsonFileAtomic(filePath: string, data: unknown): void {
  const dir = dirname(filePath);
  mkdirSync(dir, { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`;
  const payload = JSON.stringify(data);
  try {
    writeFileSync(tmpPath, payload, 'utf8');
    renameSync(tmpPath, filePath);
  } finally {
    rmSync(tmpPath, { force: true });
  }
}
