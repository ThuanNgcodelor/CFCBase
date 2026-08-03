import { spawnSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const testDirectory = resolve(projectRoot, 'tests/server');
const testFiles = (await readdir(testDirectory))
  .filter((name) => name.endsWith('.test.cjs'))
  .sort((left, right) => left.localeCompare(right))
  .map((name) => resolve(testDirectory, name));

if (testFiles.length === 0) {
  throw new Error('Không tìm thấy server test nào.');
}

const result = spawnSync(process.execPath, ['--test', ...testFiles], {
  cwd: projectRoot,
  stdio: 'inherit',
});

if (result.error) throw result.error;
process.exitCode = result.status === null ? 1 : result.status;
