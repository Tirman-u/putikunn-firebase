import { copyFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LEGACY_JS_ASSETS = [
  'index-CbkSRPeS.js',
  'index-B0AeuiUt.js',
  'index-B4hh0jSP.js',
  'index-B7S1GrS6.js',
  'index-Dsan7_Zb.js',
  'index-l3Uff7yU.js',
  'index-CoKnHS0e.js',
  'index-Ddi5Flyh.js',
  'index-DeB36ffQ.js'
];

const LEGACY_CSS_ASSETS = [
  'index-BYclOe-y.css',
  'index-DunIf2z4.css',
  'index-DsvgTB7g.css'
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const distDir = process.env.PUTIKUNN_DIST_DIR || path.join(projectRoot, 'dist');
const assetsDir = path.join(distDir, 'assets');

const readEntryAssets = async () => {
  const html = await readFile(path.join(distDir, 'index.html'), 'utf8');
  const jsMatch = html.match(/\/assets\/([^"']+\.js)/);
  const cssMatch = html.match(/\/assets\/([^"']+\.css)/);
  return {
    js: jsMatch?.[1],
    css: cssMatch?.[1]
  };
};

const copyAliases = async (sourceAsset, aliases) => {
  if (!sourceAsset) return;
  await mkdir(assetsDir, { recursive: true });
  const sourcePath = path.join(assetsDir, sourceAsset);
  await Promise.all(
    aliases
      .filter((alias) => alias !== sourceAsset)
      .map((alias) => copyFile(sourcePath, path.join(assetsDir, alias)))
  );
};

const { js, css } = await readEntryAssets();
await copyAliases(js, LEGACY_JS_ASSETS);
await copyAliases(css, LEGACY_CSS_ASSETS);
