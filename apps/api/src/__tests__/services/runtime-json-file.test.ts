import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

type ChildResult = {
  code: number | null;
  signal: NodeJS.Signals | null;
  stderr: string;
};

async function runConcurrentWriters(helperPath: string, targetPath: string): Promise<ChildResult[]> {
  const tsxPath = resolve(process.cwd(), 'node_modules/.bin/tsx');
  const startAt = Date.now() + 800;
  const workerCount = 8;
  const writesPerWorker = 200;
  const childCode = `
    import { writeJsonFileAtomic } from ${JSON.stringify(helperPath)};
    const targetPath = process.argv[1];
    const startAt = Number(process.argv[2]);
    const writesPerWorker = Number(process.argv[3]);
    while (Date.now() < startAt) {}
    for (let index = 0; index < writesPerWorker; index += 1) {
      writeJsonFileAtomic(targetPath, { pid: process.pid, index });
    }
  `;

  return Promise.all(
    Array.from({ length: workerCount }, () => new Promise<ChildResult>((resolveChild) => {
      const child = spawn(tsxPath, ['--eval', childCode, targetPath, String(startAt), String(writesPerWorker)], {
        cwd: process.cwd(),
        stdio: ['ignore', 'ignore', 'pipe'],
      });
      let stderr = '';
      child.stderr.on('data', (chunk) => {
        stderr += String(chunk);
      });
      child.on('exit', (code, signal) => {
        resolveChild({ code, signal, stderr });
      });
    }))
  );
}

describe('runtime JSON file helpers', () => {
  it.each([
    ['read-model helper', 'src/services/read-models/runtime-json-file.ts'],
    ['legacy helper', 'src/services/runtime-json-file.ts'],
  ])('avoids temp-file collisions during concurrent writes (%s)', async (_label, relativeHelperPath) => {
    const dir = mkdtempSync(join(tmpdir(), 'cerebro-runtime-json-'));
    const targetPath = join(dir, 'shared.json');
    const helperPath = resolve(process.cwd(), relativeHelperPath);

    try {
      const results = await runConcurrentWriters(helperPath, targetPath);
      const failures = results.filter((result) => result.code !== 0 || result.signal !== null);

      expect(failures).toEqual([]);
      expect(JSON.parse(readFileSync(targetPath, 'utf8'))).toEqual({
        pid: expect.any(Number),
        index: expect.any(Number),
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
