import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export function readJsonFileSafe<T>(filePath: string): T | null {
  try {
    const raw = readFileSync(filePath, 'utf8');
    if (!raw.trim()) return null;
    return JSON.parse(raw) as T;
  } catch (error: any) {
    if (error?.code === 'ENOENT') return null;
    console.warn(`[RuntimeJsonFile] Failed to read ${filePath}:`, error);
    return null;
  }
}

export function writeJsonFileAtomic(filePath: string, data: unknown): void {
  const dir = dirname(filePath);
  mkdirSync(dir, { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  const payload = JSON.stringify(data, null, 2);
  writeFileSync(tmpPath, payload, 'utf8');
  renameSync(tmpPath, filePath);
}

