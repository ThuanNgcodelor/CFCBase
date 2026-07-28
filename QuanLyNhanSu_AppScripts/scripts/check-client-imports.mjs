import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const projectRoot = resolve(import.meta.dirname, '..');
const clientRoot = resolve(projectRoot, 'src/client');
const localLucide = resolve(projectRoot, 'node_modules/lucide-react/dist/cjs/lucide-react.js');
const workspaceLucide = resolve(
  projectRoot,
  '../frontend/node_modules/lucide-react/dist/cjs/lucide-react.js',
);
const lucide = require(existsSync(localLucide) ? localLucide : workspaceLucide);
const sourceFiles = [];

async function collectSourceFiles(directory) {
  for (const name of await readdir(directory)) {
    const filePath = resolve(directory, name);
    const metadata = await stat(filePath);
    if (metadata.isDirectory()) {
      await collectSourceFiles(filePath);
    } else if (/\.[jt]sx?$/.test(name)) {
      sourceFiles.push(filePath);
    }
  }
}

await collectSourceFiles(clientRoot);

const importedIcons = new Map();
const importPattern =
  /import\s*\{([\s\S]*?)\}\s*from\s*['"]lucide-react['"]/g;

for (const filePath of sourceFiles) {
  const source = await readFile(filePath, 'utf8');
  for (const match of source.matchAll(importPattern)) {
    for (const importedPart of match[1].split(',')) {
      const importedName = importedPart.trim().split(/\s+as\s+/)[0];
      if (!importedName) continue;
      if (!importedIcons.has(importedName)) importedIcons.set(importedName, []);
      importedIcons.get(importedName).push(filePath);
    }
  }
}

const missing = [...importedIcons.keys()].filter(
  (importedName) => lucide[importedName] === undefined,
);

if (missing.length > 0) {
  throw new Error(`lucide-react không export icon: ${missing.join(', ')}`);
}

process.stdout.write(`Verified ${importedIcons.size} lucide-react imports\n`);
