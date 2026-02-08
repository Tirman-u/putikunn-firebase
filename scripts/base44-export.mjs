import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@base44/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const APP_ID = process.env.BASE44_APP_ID;
const BASE_URL = process.env.BASE44_APP_BASE_URL;
const TOKEN = process.env.BASE44_TOKEN;
const FUNCTIONS_VERSION = process.env.BASE44_FUNCTIONS_VERSION;

if (!APP_ID || !BASE_URL || !TOKEN) {
  console.error('Missing BASE44_APP_ID / BASE44_APP_BASE_URL / BASE44_TOKEN env vars.');
  process.exit(1);
}

const client = createClient({
  appId: APP_ID,
  token: TOKEN,
  functionsVersion: FUNCTIONS_VERSION,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl: BASE_URL
});

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

const fetchAll = async (entityName) => {
  const pageSize = 200;
  let skip = 0;
  let results = [];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const page = await client.entities[entityName].list('-created_date', pageSize, skip);
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
    if (!client.entities?.[entityName]) {
      console.warn(`Entity not found in Base44: ${entityName}`);
      continue;
    }
    console.log(`Exporting ${entityName}...`);
    const data = await fetchAll(entityName);
    const outPath = path.join(EXPORT_DIR, `${entityName}.json`);
    fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
    summary[entityName] = data.length;
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
