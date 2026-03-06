import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
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
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`;
  const payload = JSON.stringify(data);
  try {
    writeFileSync(tmpPath, payload, 'utf8');
    renameSync(tmpPath, filePath);
  } finally {
    rmSync(tmpPath, { force: true });
  }
}
