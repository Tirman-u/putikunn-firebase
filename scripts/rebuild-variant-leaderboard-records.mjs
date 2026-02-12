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

const args = process.argv.slice(2);

const getArg = (flag) => {
  const index = args.indexOf(flag);
  if (index === -1) return null;
  return args[index + 1] || null;
};

function getArgList(flag) {
  const values = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === flag && args[i + 1]) values.push(args[i + 1]);
  }
  return values;
}

const dryRun = !args.includes('--apply');
const testConfirm = args.includes('--test');
const expectedProject = getArg('--project') || 'putikunn-migration';
const explicitTypes = getArgList('--type').filter(Boolean);
const defaultTypes = ['time_ladder', 'streak_challenge', 'around_the_world'];
const targetTypes = explicitTypes.length ? explicitTypes : defaultTypes;

if (!dryRun && !testConfirm) {
  console.error('Safety check failed: use --apply --test to run writes in test workflow.');
  process.exit(1);
}

if (serviceAccount.project_id !== expectedProject) {
  console.error(`Project mismatch. Service account project is "${serviceAccount.project_id}", expected "${expectedProject}".`);
  process.exit(1);
}

if (targetTypes.length === 0 || targetTypes.length > 10) {
  console.error('Type list must contain 1..10 game types.');
  process.exit(1);
}

const normalizeEmail = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');
const normalizeName = (value) => (typeof value === 'string' ? value.trim() : '');
const round1 = (value) => Math.round((Number(value) || 0) * 10) / 10;

const normalizeGender = (gender) => {
  if (!gender) return undefined;
  const normalized = typeof gender === 'string' ? gender.trim().toUpperCase() : gender;
  if (['N', 'F', 'FEMALE', 'NAINE', 'W', 'WOMAN', 'WOMEN'].includes(normalized)) return 'N';
  if (['M', 'MALE', 'MEES', 'MAN', 'MEN'].includes(normalized)) return 'M';
  return undefined;
};

const resolveGamePlayers = (game) => {
  const players = new Set();
  (game?.players || []).forEach((name) => players.add(name));
  Object.keys(game?.total_points || {}).forEach((name) => players.add(name));
  Object.keys(game?.player_putts || {}).forEach((name) => players.add(name));
  Object.keys(game?.live_stats || {}).forEach((name) => players.add(name));
  Object.keys(game?.player_uids || {}).forEach((name) => players.add(name));
  Object.keys(game?.player_emails || {}).forEach((name) => players.add(name));
  Object.keys(game?.player_distances || {}).forEach((name) => players.add(name));
  Object.keys(game?.player_highest_streaks || {}).forEach((name) => players.add(name));
  Object.keys(game?.atw_state || {}).forEach((name) => players.add(name));
  return Array.from(players).filter(Boolean);
};

const getPlayerStats = (game, playerName) => {
  if (game?.game_type === 'around_the_world') {
    const state = game?.atw_state?.[playerName] || {};
    const currentScore = Number(game?.total_points?.[playerName] || 0);
    const score = Math.max(Number(state?.best_score || 0), currentScore);
    const madePutts = Number(state?.total_makes || 0);
    const totalPutts = Number(state?.total_putts || 0);
    const currentAccuracy = totalPutts > 0 ? (madePutts / totalPutts) * 100 : 0;
    const accuracy = Math.max(Number(state?.best_accuracy || 0), currentAccuracy);
    return { score, madePutts, totalPutts, accuracy };
  }

  const putts = game?.player_putts?.[playerName] || [];
  const liveStats = game?.live_stats?.[playerName] || {};
  const hasPutts = putts.length > 0;
  const madePutts = hasPutts
    ? putts.filter((putt) => putt?.result === 'made').length
    : Number(liveStats?.made_putts || 0);
  const totalPutts = hasPutts ? putts.length : Number(liveStats?.total_putts || 0);
  const accuracy = totalPutts > 0 ? (madePutts / totalPutts) * 100 : 0;

  const totalPoints = Number(game?.total_points?.[playerName] ?? liveStats?.total_points ?? 0);
  if (game?.game_type === 'streak_challenge') {
    const highestStreak = Number(game?.player_highest_streaks?.[playerName] || 0);
    return {
      score: Math.max(totalPoints, highestStreak),
      madePutts,
      totalPutts,
      accuracy
    };
  }

  return {
    score: totalPoints,
    madePutts,
    totalPutts,
    accuracy
  };
};

const buildVariantForGame = (game, playerName) => {
  if (game?.game_type === 'time_ladder') {
    const discs = Number(game?.time_ladder_config?.discs_per_turn);
    return {
      key: `time_discs:${Number.isFinite(discs) && discs > 0 ? discs : 'unknown'}`,
      fields: Number.isFinite(discs) && discs > 0 ? { time_ladder_discs_per_turn: discs } : {}
    };
  }
  if (game?.game_type === 'streak_challenge') {
    const distance = Number(game?.player_distances?.[playerName] || 0);
    return {
      key: `streak_distance:${Number.isFinite(distance) && distance > 0 ? distance : 0}`,
      fields: { streak_distance: Number.isFinite(distance) && distance > 0 ? distance : 0 }
    };
  }
  if (game?.game_type === 'around_the_world') {
    const discs = Number(game?.atw_config?.discs_per_turn);
    return {
      key: `atw_discs:${Number.isFinite(discs) && discs > 0 ? discs : 'unknown'}`,
      fields: Number.isFinite(discs) && discs > 0 ? { atw_discs_per_turn: discs } : {}
    };
  }
  return { key: 'default', fields: {} };
};

const buildVariantForEntry = (entry, gameById) => {
  if (entry?.game_type === 'time_ladder') {
    const direct = Number(entry?.time_ladder_discs_per_turn);
    const fallback = Number(gameById[entry?.game_id]?.time_ladder_config?.discs_per_turn);
    const discs = Number.isFinite(direct) && direct > 0 ? direct : (Number.isFinite(fallback) && fallback > 0 ? fallback : null);
    return `time_discs:${discs || 'unknown'}`;
  }
  if (entry?.game_type === 'streak_challenge') {
    const distance = Number(entry?.streak_distance);
    return `streak_distance:${Number.isFinite(distance) && distance > 0 ? distance : 0}`;
  }
  if (entry?.game_type === 'around_the_world') {
    const direct = Number(entry?.atw_discs_per_turn);
    const fallback = Number(gameById[entry?.game_id]?.atw_config?.discs_per_turn);
    const discs = Number.isFinite(direct) && direct > 0 ? direct : (Number.isFinite(fallback) && fallback > 0 ? fallback : null);
    return `atw_discs:${discs || 'unknown'}`;
  }
  return 'default';
};

const isLowerBetter = (gameType) => gameType === 'time_ladder';
const isBetterScore = (gameType, nextScore, prevScore) => {
  const safeNext = Number(nextScore || 0);
  const safePrev = Number(prevScore || 0);
  return isLowerBetter(gameType) ? safeNext < safePrev : safeNext > safePrev;
};

const userByUidCache = new Map();
const userByEmailCache = new Map();

const getUserByUid = async (uid) => {
  if (!uid) return null;
  if (userByUidCache.has(uid)) return userByUidCache.get(uid);
  const snap = await db.collection('users').doc(uid).get();
  const user = snap.exists ? { id: snap.id, ...snap.data() } : null;
  userByUidCache.set(uid, user);
  if (user?.email) {
    userByEmailCache.set(normalizeEmail(user.email), user);
  }
  return user;
};

const getUserByEmail = async (email) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  if (userByEmailCache.has(normalized)) return userByEmailCache.get(normalized);
  const snap = await db.collection('users').where('email', '==', normalized).limit(1).get();
  const user = snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
  userByEmailCache.set(normalized, user);
  if (user?.id) {
    userByUidCache.set(user.id, user);
  }
  return user;
};

const resolveIdentity = async (game, playerName) => {
  const mappedUid = game?.player_uids?.[playerName];
  const mappedEmail = normalizeEmail(game?.player_emails?.[playerName]);
  let user = await getUserByUid(mappedUid);
  if (!user && mappedEmail) {
    user = await getUserByEmail(mappedEmail);
  }

  const resolvedName = normalizeName(
    user?.full_name
    || user?.display_name
    || user?.fullName
    || user?.displayName
    || playerName
  ) || playerName;

  const resolvedUid = user?.id || mappedUid || undefined;
  const resolvedEmail = normalizeEmail(user?.email || mappedEmail) || undefined;
  const resolvedGender = normalizeGender(user?.gender);

  return {
    playerName: resolvedName,
    playerUid: resolvedUid,
    playerEmail: resolvedEmail,
    playerGender: resolvedGender
  };
};

const getPlayerKeyFromIdentity = (identity) => {
  if (identity?.playerUid) return `uid:${identity.playerUid}`;
  const email = normalizeEmail(identity?.playerEmail);
  if (email && email !== 'unknown') return `email:${email}`;
  const name = normalizeName(identity?.playerName).toLowerCase();
  if (name) return `name:${name}`;
  return '';
};

const getPlayerKeyFromEntry = (entry) => {
  if (entry?.player_uid) return `uid:${entry.player_uid}`;
  const email = normalizeEmail(entry?.player_email);
  if (email && email !== 'unknown') return `email:${email}`;
  const name = normalizeName(entry?.player_name).toLowerCase();
  if (name) return `name:${name}`;
  return '';
};

const toComparable = (entry) => ({
  game_id: entry?.game_id || null,
  player_uid: entry?.player_uid || null,
  player_email: normalizeEmail(entry?.player_email) || 'unknown',
  player_name: normalizeName(entry?.player_name),
  player_gender: normalizeGender(entry?.player_gender) || null,
  game_type: entry?.game_type || null,
  score: Number(entry?.score || 0),
  accuracy: round1(entry?.accuracy || 0),
  made_putts: Number(entry?.made_putts || 0),
  total_putts: Number(entry?.total_putts || 0),
  leaderboard_type: entry?.leaderboard_type || null,
  time_ladder_discs_per_turn: Number(entry?.time_ladder_discs_per_turn || 0) || 0,
  streak_distance: Number(entry?.streak_distance || 0) || 0,
  atw_discs_per_turn: Number(entry?.atw_discs_per_turn || 0) || 0,
  date: entry?.date ? new Date(entry.date).toISOString() : null
});

const commitInChunks = async (writers) => {
  const CHUNK_SIZE = 350;
  for (let i = 0; i < writers.length; i += CHUNK_SIZE) {
    const chunk = writers.slice(i, i + CHUNK_SIZE);
    const batch = db.batch();
    chunk.forEach((fn) => fn(batch));
    await batch.commit();
  }
};

const run = async () => {
  console.log(JSON.stringify({
    mode: dryRun ? 'dry-run' : 'apply',
    project: serviceAccount.project_id,
    expectedProject,
    targetTypes
  }, null, 2));

  const gamesSnap = await db.collection('games').where('game_type', 'in', targetTypes).get();
  const games = gamesSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  const gameById = {};
  games.forEach((game) => { gameById[game.id] = game; });

  const entriesSnap = await db.collection('leaderboard_entries')
    .where('leaderboard_type', '==', 'general')
    .where('game_type', 'in', targetTypes)
    .get();
  const existingEntries = entriesSnap.docs.map((docSnap) => ({ id: docSnap.id, ref: docSnap.ref, ...docSnap.data() }));

  const bySignature = new Map();
  const duplicateRefs = [];
  for (const entry of existingEntries) {
    const playerKey = getPlayerKeyFromEntry(entry);
    if (!playerKey || !entry?.game_id || !entry?.game_type) continue;
    const variantKey = buildVariantForEntry(entry, gameById);
    const signature = `${playerKey}|game:${entry.game_id}|type:${entry.game_type}|${variantKey}`;
    const current = bySignature.get(signature);
    if (!current) {
      bySignature.set(signature, entry);
      continue;
    }

    const keepNew = isBetterScore(entry.game_type, entry.score, current.score)
      || (Number(entry.score || 0) === Number(current.score || 0)
        && new Date(entry.date || 0).getTime() > new Date(current.date || 0).getTime());

    if (keepNew) {
      if (current?.ref) duplicateRefs.push(current.ref);
      bySignature.set(signature, entry);
    } else if (entry?.ref) {
      duplicateRefs.push(entry.ref);
    }
  }

  let scannedPlayers = 0;
  let skippedNoScore = 0;
  let expectedCount = 0;
  let created = 0;
  let updated = 0;
  const writeOps = [];

  for (const game of games) {
    const players = resolveGamePlayers(game);
    for (const rawPlayerName of players) {
      scannedPlayers += 1;
      const stats = getPlayerStats(game, rawPlayerName);
      const score = Number(stats?.score || 0);
      if (!Number.isFinite(score) || score <= 0) {
        skippedNoScore += 1;
        continue;
      }

      const identity = await resolveIdentity(game, rawPlayerName);
      const playerKey = getPlayerKeyFromIdentity(identity);
      if (!playerKey) {
        skippedNoScore += 1;
        continue;
      }

      const variant = buildVariantForGame(game, rawPlayerName);
      const signature = `${playerKey}|game:${game.id}|type:${game.game_type}|${variant.key}`;
      expectedCount += 1;

      const payload = {
        game_id: game.id,
        ...(identity.playerUid ? { player_uid: identity.playerUid } : {}),
        player_email: identity.playerEmail || 'unknown',
        player_name: identity.playerName,
        game_type: game.game_type,
        score,
        accuracy: round1(stats?.accuracy || 0),
        made_putts: Number(stats?.madePutts || 0),
        total_putts: Number(stats?.totalPutts || 0),
        leaderboard_type: 'general',
        ...(identity.playerGender ? { player_gender: identity.playerGender } : {}),
        ...variant.fields,
        date: new Date(game.date || new Date().toISOString()).toISOString(),
        updated_date: new Date().toISOString(),
        _server_updated_at: admin.firestore.FieldValue.serverTimestamp()
      };

      const existing = bySignature.get(signature);
      if (!existing?.id) {
        created += 1;
        writeOps.push((batch) => {
          const docRef = db.collection('leaderboard_entries').doc();
          batch.set(docRef, {
            ...payload,
            created_date: new Date().toISOString(),
            _server_created_at: admin.firestore.FieldValue.serverTimestamp()
          });
        });
        continue;
      }

      const nextComparable = toComparable(payload);
      const existingComparable = toComparable(existing);
      if (JSON.stringify(nextComparable) !== JSON.stringify(existingComparable)) {
        updated += 1;
        writeOps.push((batch) => {
          batch.set(existing.ref, payload, { merge: true });
        });
      }
    }
  }

  for (const ref of duplicateRefs) {
    writeOps.push((batch) => {
      batch.delete(ref);
    });
  }

  const summary = {
    scannedGames: games.length,
    scannedPlayers,
    existingEntries: existingEntries.length,
    expectedRecords: expectedCount,
    duplicateCandidates: duplicateRefs.length,
    skippedNoScore,
    created,
    updated,
    writeOps: writeOps.length
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!dryRun && writeOps.length > 0) {
    await commitInChunks(writeOps);
    console.log('Applied writes:', writeOps.length);
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
