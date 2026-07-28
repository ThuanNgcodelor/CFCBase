import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const [server, html, manifestText] = await Promise.all([
  readFile(resolve(projectRoot, 'dist/Code.js'), 'utf8'),
  readFile(resolve(projectRoot, 'dist/Index.html'), 'utf8'),
  readFile(resolve(projectRoot, 'dist/appsscript.json'), 'utf8'),
]);

JSON.parse(manifestText);

const requiredServerEntrypoints = [
  'doGet',
  'apiBootstrap',
  'apiListEmployees',
  'apiGetEmployee',
  'apiSaveEmployee',
  'apiListCatalogs',
  'apiSaveCatalog',
  'apiListMovements',
  'apiCreateMovement',
  'apiConfirmMovement',
  'apiListRosters',
  'apiListProbationCandidates',
  'apiSaveProbationCandidate',
  'apiRunProbationAction',
];

const missing = requiredServerEntrypoints.filter(
  (name) => !new RegExp(`function\\s+${name}\\s*\\(`).test(server),
);

if (missing.length > 0) {
  throw new Error(`Thiếu RPC entrypoint: ${missing.join(', ')}`);
}

const forbiddenServerPatterns = [
  [
    'public Drive sharing',
    /setSharing\s*\(\s*DriveApp\.Access\.(?:ANYONE|ANYONE_WITH_LINK)\b/,
  ],
  ['embedded spreadsheet assignment', /SPREADSHEET_ID\s*=\s*['"][^'"]+['"]/],
  ['source map marker', /sourceMappingURL=/],
];

for (const [label, pattern] of forbiddenServerPatterns) {
  if (pattern.test(server)) throw new Error(`Artifact server chứa ${label}.`);
}

if (!/<div\s+id=["']root["']/.test(html)) {
  throw new Error('Index.html không có React root.');
}
if (/<(?:script|link)\b[^>]*(?:src|href)=["'][^"']*\/(?:assets|src)\//i.test(html)) {
  throw new Error('Index.html còn tham chiếu asset local, chưa phù hợp single-file HTMLService.');
}
if (/<script[^>]+src=["'](?!https:)/.test(html)) {
  throw new Error('Index.html còn script src không phải HTTPS.');
}
if (/sourceMappingURL=/.test(html)) {
  throw new Error('Index.html chứa source map marker.');
}

process.stdout.write(
  `Verified dist: Code.js ${server.length} bytes, Index.html ${html.length} bytes\n`,
);
