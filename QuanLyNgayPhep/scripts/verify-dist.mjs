import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const [manifest, code, html] = await Promise.all([
  readFile(resolve(root, 'dist/appsscript.json'), 'utf8'),
  readFile(resolve(root, 'dist/Code.js'), 'utf8'),
  readFile(resolve(root, 'dist/Index.html'), 'utf8'),
]);

JSON.parse(manifest);

const required = [
  'doGet',
  'setupLeaveWorkbook',
  'clearLeaveCache',
  'importMonthlyRoster',
  'getLeaveDashboard',
  'getLeaveEmployees',
  'getApproverDashboard',
  'createLeaveRequest',
  'approveLeaveRequest',
  'adjustAnnualLeave',
  'exportLeaveCsv',
];

const missing = required.filter((name) => !new RegExp(`function\\s+${name}\\s*\\(`).test(code));
if (missing.length) throw new Error(`Thiếu Apps Script entrypoint: ${missing.join(', ')}`);

if (!/Quản lý ngày phép/.test(html)) throw new Error('Index.html thiếu tiêu đề app.');
if (!/google\.script\.run/.test(html)) throw new Error('Index.html thiếu google.script.run.');
if (/sourceMappingURL=/.test(code + html)) throw new Error('Artifact chứa source map marker.');

process.stdout.write(`Verified dist: Code.js ${code.length} bytes, Index.html ${html.length} bytes\n`);
