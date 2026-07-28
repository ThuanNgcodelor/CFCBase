import { execFileSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const serverDir = resolve(projectRoot, 'src/server');
const sourceFiles = (await readdir(serverDir))
  .filter((name) => name.endsWith('.js'))
  .sort((left, right) => left.localeCompare(right));

for (const fileName of sourceFiles) {
  execFileSync(process.execPath, ['--check', resolve(serverDir, fileName)], {
    stdio: 'inherit',
  });
}

process.stdout.write(`Syntax checked ${sourceFiles.length} server modules\n`);
