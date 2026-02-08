import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT
  || path.resolve(__dirname, '../firebase-service-account.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('Service account JSON not found:', serviceAccountPath);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  });
}

const db = admin.firestore();

const EXPORT_DIR = process.env.BASE44_EXPORT_DIR
  || path.resolve(__dirname, '../exports/base44');

if (!fs.existsSync(EXPORT_DIR)) {
  console.error('Export directory not found:', EXPORT_DIR);
  process.exit(1);
}

const ENTITY_COLLECTIONS = {
  User: 'users',
  Game: 'games',
  GameGroup: 'game_groups',
  LeaderboardEntry: 'leaderboard_entries',
  PuttingKingTournament: 'putting_king_tournaments',
  PuttingKingStation: 'putting_king_stations',
  PuttingKingMatch: 'putting_king_matches',
  PuttingKingPlayer: 'putting_king_players',
  TournamentRules: 'tournament_rules',
  DuelGame: 'duel_games'
};

const batchWrite = async (collectionName, rows) => {
  const batchSize = 400;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = db.batch();
    const slice = rows.slice(i, i + batchSize);
    slice.forEach((row) => {
      if (!row?.id) return;
      const docRef = db.collection(collectionName).doc(row.id);
      const payload = { ...row };
      delete payload.id;

      if (collectionName === 'users') {
        const displayName = payload.display_name || payload.full_name || payload.displayName || payload.fullName;
        if (displayName) {
          payload.displayName = payload.displayName || displayName;
          payload.display_name = payload.display_name || displayName;
          payload.fullName = payload.fullName || displayName;
          payload.full_name = payload.full_name || displayName;
        }
      }

      batch.set(docRef, payload, { merge: true });
    });
    await batch.commit();
  }
};

const run = async () => {
  const summary = {};
  for (const [entityName, collectionName] of Object.entries(ENTITY_COLLECTIONS)) {
    const filePath = path.join(EXPORT_DIR, `${entityName}.json`);
    if (!fs.existsSync(filePath)) {
      console.warn(`Missing export file: ${filePath}`);
      continue;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const rows = JSON.parse(raw);
    if (!Array.isArray(rows)) {
      console.warn(`Invalid JSON array in ${filePath}`);
      continue;
    }
    console.log(`Importing ${entityName} -> ${collectionName} (${rows.length})`);
    await batchWrite(collectionName, rows);
    summary[entityName] = rows.length;
  }

  console.log('Import complete:', summary);
};

run().catch((error) => {
  console.error('Import failed:', error);
  process.exit(1);
});
