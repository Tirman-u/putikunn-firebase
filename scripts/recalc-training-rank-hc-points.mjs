import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const round1 = (value) => Math.round((Number(value) || 0) * 10) / 10;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const getCutCount = ({ participantsCount, cutPercent }) => {
  const safeParticipants = Math.max(0, Number(participantsCount) || 0);
  const safeCutPercent = clamp(Number(cutPercent) || 0, 0, 100);
  if (safeParticipants === 0 || safeCutPercent === 0) return 0;
  return Math.ceil((safeParticipants * safeCutPercent) / 100);
};

const computeRankCutPoints = ({ rank, participantsCount, cutPercent, bonusStep }) => {
  const safeRank = Number(rank);
  const cutCount = getCutCount({ participantsCount, cutPercent });
  const qualifies = Number.isFinite(safeRank) && safeRank > 0 && safeRank <= cutCount;
  const stepCount = qualifies ? (cutCount - safeRank + 1) : 0;
  const cutBonus = qualifies ? round1(stepCount * Math.max(0, Number(bonusStep) || 0)) : 0;
  return {
    cutCount,
    cutBonus,
    points: round1(1 + cutBonus)
  };
};

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
  const idx = args.indexOf(flag);
  if (idx === -1) return null;
  return args[idx + 1];
};
const getArgList = (flag) => {
  const values = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === flag && args[i + 1]) values.push(args[i + 1]);
  }
  return values;
};

const dryRun = !args.includes('--apply');
const testConfirm = args.includes('--test');
const expectedProject = getArg('--project') || 'putikunn-migration';
const seasonFilter = new Set(getArgList('--season-id').filter(Boolean));
const eventFilter = new Set(getArgList('--event-id').filter(Boolean));
const bonusStepOverrideRaw = getArg('--bonus-step');
const bonusStepOverride = bonusStepOverrideRaw === null ? null : Math.max(0, Number(bonusStepOverrideRaw) || 0);

if (!dryRun && !testConfirm) {
  console.error('Safety check failed: use --apply --test to run writes in test workflow.');
  process.exit(1);
}

if (serviceAccount.project_id !== expectedProject) {
  console.error(`Project mismatch. Service account project is "${serviceAccount.project_id}", expected "${expectedProject}".`);
  process.exit(1);
}

const commitInChunks = async (writes) => {
  const CHUNK_SIZE = 400;
  for (let i = 0; i < writes.length; i += CHUNK_SIZE) {
    const chunk = writes.slice(i, i + CHUNK_SIZE);
    const batch = db.batch();
    chunk.forEach((writer) => writer(batch));
    await batch.commit();
  }
};

const run = async () => {
  console.log(
    JSON.stringify({
      mode: dryRun ? 'dry-run' : 'apply',
      project: serviceAccount.project_id,
      expectedProject,
      seasonFilter: Array.from(seasonFilter),
      eventFilter: Array.from(eventFilter),
      bonusStepOverride
    }, null, 2)
  );

  const eventsSnap = await db.collection('training_events').where('offline_mode', '==', 'rank_hc').get();
  const events = eventsSnap.docs
    .map((docSnap) => ({ id: docSnap.id, ref: docSnap.ref, ...docSnap.data() }))
    .filter((event) => {
      if (seasonFilter.size && !seasonFilter.has(event.season_id)) return false;
      if (eventFilter.size && !eventFilter.has(event.id)) return false;
      return true;
    });

  let scannedEvents = 0;
  let scannedResults = 0;
  let updatedEvents = 0;
  let updatedResults = 0;
  let updatedStats = 0;
  let skippedResults = 0;

  const writes = [];
  const statsDeltas = new Map();
  const nowIso = new Date().toISOString();

  for (const event of events) {
    scannedEvents += 1;
    const participantsCount = Math.max(0, Number(event.participants_count) || 0);
    const cutPercent = clamp(Number(event.cut_percent) || 70, 0, 100);
    const bonusStep = round1(bonusStepOverride === null
      ? Math.max(0, Number(event.cut_bonus) || 0.3)
      : bonusStepOverride);
    const cutCount = getCutCount({ participantsCount, cutPercent });

    const eventNeedsUpdate =
      round1(event.cut_percent) !== round1(cutPercent)
      || round1(event.cut_bonus) !== round1(bonusStep)
      || event.rank_hc_scoring !== 'incremental_v2';

    if (eventNeedsUpdate) {
      updatedEvents += 1;
      writes.push((batch) => {
        batch.set(event.ref, {
          cut_percent: cutPercent,
          cut_bonus: round1(bonusStep),
          rank_hc_scoring: 'incremental_v2',
          updated_at: nowIso
        }, { merge: true });
      });
    }

    const resultsSnap = await db.collection('training_event_results').where('event_id', '==', event.id).get();
    for (const resultDoc of resultsSnap.docs) {
      scannedResults += 1;
      const result = resultDoc.data();
      const rank = Number(result.rank);
      if (!Number.isFinite(rank) || rank <= 0) {
        skippedResults += 1;
        continue;
      }

      const { cutBonus, points } = computeRankCutPoints({
        rank,
        participantsCount,
        cutPercent,
        bonusStep
      });

      const prevPoints = round1(result.points);
      const prevCutBonus = round1(result.cut_bonus);
      const changed = prevPoints !== points || prevCutBonus !== cutBonus;
      if (!changed) continue;

      updatedResults += 1;
      writes.push((batch) => {
        batch.set(resultDoc.ref, {
          points,
          cut_bonus: cutBonus,
          updated_at: nowIso
        }, { merge: true });
      });

      const delta = round1(points - prevPoints);
      if (delta === 0) continue;

      const seasonId = result.season_id || event.season_id;
      const participantId = result.participant_id;
      const slotId = result.slot_id || event.slot_id;
      if (!seasonId || !participantId || !slotId) continue;

      const key = `${seasonId}__${participantId}`;
      const existing = statsDeltas.get(key) || {
        seasonId,
        participantId,
        userId: result.user_id || null,
        playerName: result.player_name || '',
        totalDelta: 0,
        slotDeltas: {}
      };
      existing.totalDelta = round1(existing.totalDelta + delta);
      existing.slotDeltas[slotId] = round1((existing.slotDeltas[slotId] || 0) + delta);
      statsDeltas.set(key, existing);
    }

    if (participantsCount < cutCount) {
      console.warn(`Event ${event.id}: cutCount (${cutCount}) is higher than participantsCount (${participantsCount}).`);
    }
  }

  for (const payload of statsDeltas.values()) {
    const statsDocId = `${payload.seasonId}_${payload.participantId}`;
    const statsRef = db.collection('training_season_stats').doc(statsDocId);
    const statsSnap = await statsRef.get();
    const current = statsSnap.exists ? statsSnap.data() : {};
    const currentPointsBySlot = current?.points_by_slot && typeof current.points_by_slot === 'object'
      ? { ...current.points_by_slot }
      : {};

    Object.entries(payload.slotDeltas).forEach(([slotId, delta]) => {
      currentPointsBySlot[slotId] = round1(Math.max(0, (Number(currentPointsBySlot[slotId]) || 0) + delta));
    });

    const nextTotal = round1(Math.max(0, (Number(current?.points_total) || 0) + payload.totalDelta));
    updatedStats += 1;
    writes.push((batch) => {
      batch.set(statsRef, {
        season_id: payload.seasonId,
        participant_id: payload.participantId,
        ...(payload.userId ? { user_id: payload.userId } : {}),
        ...(payload.playerName ? { player_name: payload.playerName } : {}),
        points_total: nextTotal,
        points_by_slot: currentPointsBySlot,
        rank_hc_recalculated_at: nowIso,
        updated_at: nowIso
      }, { merge: true });
    });
  }

  console.log(
    JSON.stringify({
      scannedEvents,
      scannedResults,
      updatedEvents,
      updatedResults,
      updatedStats,
      skippedResults,
      pendingWrites: writes.length
    }, null, 2)
  );

  if (dryRun) {
    console.log('Dry-run complete. Re-run with --apply --test to write changes.');
    return;
  }

  if (writes.length > 0) {
    await commitInChunks(writes);
  }
  console.log('Apply complete.');
};

run().catch((error) => {
  console.error('Recalculation failed:', error);
  process.exit(1);
});
