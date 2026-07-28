import { readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '../../..');
const distDir = join(projectRoot, 'dist');
const sourceHtmlPath = join(distDir, 'index.html');
const outputHtmlPath = join(distDir, 'Index.html');

let html = await readFile(sourceHtmlPath, 'utf8');

const assetPathFromUrl = (url) => {
  const cleanUrl = url.replace(/^[./]+/, '').split('?')[0];
  return join(distDir, cleanUrl);
};

const stylesheetPattern = /<link\s+[^>]*href="([^"]+\.css)"[^>]*>/g;
for (const match of [...html.matchAll(stylesheetPattern)]) {
  const css = await readFile(assetPathFromUrl(match[1]), 'utf8');
  html = html.replace(
    match[0],
    () => `<style data-cfc-bundle="styles">${css}</style>`
  );
}

const modulePattern = /<script\s+[^>]*src="([^"]+\.js)"[^>]*><\/script>/g;
for (const match of [...html.matchAll(modulePattern)]) {
  const javascript = await readFile(assetPathFromUrl(match[1]), 'utf8');
  const safeJavascript = javascript.replace(/<\/script/gi, '<\\/script');
  html = html.replace(match[0], () =>
    `<script type="module" data-cfc-bundle="client">${safeJavascript}</script>`
  );
}

html = html.replace(/\s*<link\s+rel="modulepreload"[^>]*>/g, '');
await writeFile(sourceHtmlPath, html, 'utf8');
await rename(sourceHtmlPath, outputHtmlPath);

const assetsDir = join(distDir, 'assets');
await rm(assetsDir, { recursive: true, force: true });

const distFiles = await readdir(distDir);
if (distFiles.length !== 1 || distFiles[0] !== 'Index.html') {
  throw new Error(`Single-file build failed: dist contains ${distFiles.join(', ')}`);
}

const finalHtml = await readFile(outputHtmlPath, 'utf8');
if (!finalHtml.includes('data-cfc-bundle="client"')) {
  throw new Error('Single-file build failed: client bundle was not inlined.');
}

process.stdout.write(`Created ${outputHtmlPath}\n`);
