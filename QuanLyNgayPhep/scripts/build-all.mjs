import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');

const syntax = spawnSync(process.execPath, ['-c', resolve(root, 'Code.js')], {
  cwd: root,
  encoding: 'utf8',
});

if (syntax.status !== 0) {
  process.stderr.write(syntax.stderr || syntax.stdout);
  process.exit(syntax.status || 1);
}

const [manifest, code, html] = await Promise.all([
  readFile(resolve(root, 'appsscript.json'), 'utf8'),
  readFile(resolve(root, 'Code.js'), 'utf8'),
  readFile(resolve(root, 'Index.html'), 'utf8'),
]);

JSON.parse(manifest);

if (!/function\s+doGet\s*\(/.test(code)) {
  throw new Error('Code.js thiếu doGet.');
}
if (!/function\s+getLeaveDashboard\s*\(/.test(code)) {
  throw new Error('Code.js thiếu getLeaveDashboard.');
}
if (!/<script>[\s\S]*google\.script\.run/.test(html)) {
  throw new Error('Index.html chưa có client gọi google.script.run.');
}

await mkdir(dist, { recursive: true });
await Promise.all([
  writeFile(resolve(dist, 'appsscript.json'), `${manifest.trim()}\n`, 'utf8'),
  writeFile(resolve(dist, 'Code.js'), `${code.trim()}\n`, 'utf8'),
  writeFile(resolve(dist, 'Index.html'), `${html.trim()}\n`, 'utf8'),
]);

process.stdout.write('Built QuanLyNgayPhep into dist\n');
