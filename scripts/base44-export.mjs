import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const APP_ID = process.env.BASE44_APP_ID;
const BASE_URL = process.env.BASE44_APP_BASE_URL || 'https://app.base44.com';
const API_KEY = process.env.BASE44_API_KEY || process.env.BASE44_TOKEN;

if (!APP_ID || !API_KEY) {
  console.error('Missing BASE44_APP_ID / BASE44_API_KEY (or BASE44_TOKEN) env vars.');
  process.exit(1);
}

const normalizedBaseUrl = BASE_URL.replace(/\/$/, '');
const apiBase = `${normalizedBaseUrl}/api/apps/${APP_ID}/entities`;

const EXPORT_DIR = path.resolve(__dirname, '../exports/base44');
fs.mkdirSync(EXPORT_DIR, { recursive: true });

const ENTITY_LIST = [
  'User',
  'Game',
  'GameGroup',
  'LeaderboardEntry',
  'PuttingKingTournament',
  'PuttingKingStation',
  'PuttingKingMatch',
  'PuttingKingPlayer',
  'TournamentRules',
  'DuelGame'
];

const fetchPage = async (entityName, limit, skip) => {
  const params = new URLSearchParams();
  if (typeof limit === 'number') params.set('limit', String(limit));
  if (typeof skip === 'number') params.set('skip', String(skip));
  params.set('sort', '-created_date');
  const url = `${apiBase}/${entityName}?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      api_key: API_KEY,
      'Content-Type': 'application/json'
    }
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Base44 export failed (${response.status}) for ${entityName}: ${text}`);
  }
  const data = await response.json();
  return Array.isArray(data) ? data : [];
};

const fetchAll = async (entityName) => {
  const pageSize = 200;
  let skip = 0;
  let results = [];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const page = await fetchPage(entityName, pageSize, skip);
    if (!page || page.length === 0) break;
    results = results.concat(page);
    if (page.length < pageSize) break;
    skip += pageSize;
  }

  return results;
};

const run = async () => {
  const summary = {};
  for (const entityName of ENTITY_LIST) {
    try {
      console.log(`Exporting ${entityName}...`);
      const data = await fetchAll(entityName);
      const outPath = path.join(EXPORT_DIR, `${entityName}.json`);
      fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
      summary[entityName] = data.length;
    } catch (error) {
      const message = error?.message || '';
      if (message.includes('Entity schema') || message.includes('404')) {
        console.warn(`Skipping ${entityName}: ${message}`);
        continue;
      }
      throw error;
    }
  }

  fs.writeFileSync(
    path.join(EXPORT_DIR, '_summary.json'),
    JSON.stringify(summary, null, 2)
  );

  console.log('Export complete:', summary);
};

run().catch((error) => {
  console.error('Export failed:', error);
  process.exit(1);
});
