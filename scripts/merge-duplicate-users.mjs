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
const auth = admin.auth();

const ROLE_PRIORITY = {
  user: 0,
  trainer: 1,
  admin: 2,
  super_admin: 3
};

const normalizeEmail = (value) => (value || '').trim().toLowerCase();

const parseTimestamp = (value) => {
  if (!value) return 0;
  if (value instanceof admin.firestore.Timestamp) {
    return value.toMillis();
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const getUserSortScore = (user) => {
  return Math.max(
    parseTimestamp(user.updated_date),
    parseTimestamp(user.created_date),
    parseTimestamp(user._server_updated_at),
    parseTimestamp(user._server_created_at)
  );
};

const pickHigherRole = (currentRole, legacyRole) => {
  const currentPriority = ROLE_PRIORITY[currentRole] ?? ROLE_PRIORITY.user;
  const legacyPriority = ROLE_PRIORITY[legacyRole] ?? ROLE_PRIORITY.user;
  return legacyPriority > currentPriority ? legacyRole : currentRole;
};

const dedupeArray = (items = []) => {
  const seen = new Set();
  return items.filter((item) => {
    if (!item) return false;
    if (seen.has(item)) return false;
    seen.add(item);
    return true;
  });
};

const replaceUidInArray = (items = [], mapping = {}) => {
  let changed = false;
  const next = items.map((item) => {
    const mapped = mapping[item];
    if (mapped && mapped !== item) {
      changed = true;
      return mapped;
    }
    return item;
  });
  const deduped = dedupeArray(next);
  if (deduped.length !== next.length) {
    changed = true;
  }
  return { next: deduped, changed };
};

const replaceUidInMap = (map, mapping = {}) => {
  if (!map || typeof map !== 'object') {
    return { map, changed: false };
  }
  let changed = false;
  const next = { ...map };
  Object.entries(mapping).forEach(([fromUid, toUid]) => {
    if (!next[fromUid] || fromUid === toUid) return;
    if (!next[toUid]) {
      next[toUid] = next[fromUid];
    }
    delete next[fromUid];
    changed = true;
  });
  return { map: next, changed };
};

const buildDisplayName = (user) =>
  user?.display_name || user?.full_name || user?.displayName || user?.fullName || '';

const buildProfilePatch = (target, legacyUsers) => {
  const patch = {};
  const targetName = buildDisplayName(target);
  const targetEmail = normalizeEmail(target.email);
  const legacyName = legacyUsers.map(buildDisplayName).find(Boolean) || '';

  if (!targetName || targetName === targetEmail) {
    if (legacyName) {
      patch.display_name = legacyName;
      patch.displayName = legacyName;
      patch.full_name = legacyName;
      patch.fullName = legacyName;
    }
  }

  const mergedTrainingGroups = legacyUsers.reduce((acc, user) => {
    if (user.training_groups && typeof user.training_groups === 'object') {
      return { ...user.training_groups, ...acc };
    }
    return acc;
  }, { ...(target.training_groups || {}) });

  if (Object.keys(mergedTrainingGroups).length > 0) {
    patch.training_groups = mergedTrainingGroups;
  }

  ['bio', 'gender', 'profile_picture'].forEach((field) => {
    if (!target[field]) {
      const legacyValue = legacyUsers.map((user) => user[field]).find(Boolean);
      if (legacyValue) patch[field] = legacyValue;
    }
  });

  const mergedRole = legacyUsers.reduce(
    (role, user) => pickHigherRole(role, user.app_role || user._app_role || user.role),
    target.app_role || target._app_role || target.role || 'user'
  );
  if (mergedRole && mergedRole !== target.app_role) {
    patch.app_role = mergedRole;
  }

  patch.merged_from = dedupeArray([...(target.merged_from || []), ...legacyUsers.map((u) => u.id)]);
  patch.legacy_merge_done = true;
  patch.legacy_merge_checked_at = new Date().toISOString();
  return patch;
};

const applyMappingToTrainingGroup = (group, mapping) => {
  let changed = false;
  const updates = {};

  const members = { ...(group.members || {}) };
  const { map: nextMembers, changed: membersChanged } = replaceUidInMap(members, mapping);
  if (membersChanged) {
    updates.members = nextMembers;
    changed = true;
  }

  const memberUidsSource = Array.isArray(group.member_uids)
    ? group.member_uids
    : Object.keys(nextMembers || {});
  const { next: nextMemberUids, changed: memberUidsChanged } = replaceUidInArray(
    memberUidsSource,
    mapping
  );
  if (memberUidsChanged) {
    updates.member_uids = nextMemberUids;
    changed = true;
  }

  let slotsChanged = false;
  const nextSlots = (group.slots || []).map((slot) => {
    if (!Array.isArray(slot.roster_uids)) return slot;
    const { next: rosterUids, changed: rosterChanged } = replaceUidInArray(slot.roster_uids, mapping);
    if (!rosterChanged) return slot;
    slotsChanged = true;
    return { ...slot, roster_uids: rosterUids };
  });
  if (slotsChanged) {
    updates.slots = nextSlots;
    changed = true;
  }

  const attendance = group.attendance || {};
  let attendanceChanged = false;
  const nextAttendance = { ...attendance };
  Object.entries(attendance).forEach(([weekKey, weekData]) => {
    if (!weekData || typeof weekData !== 'object') return;
    let weekChanged = false;
    const nextWeek = { ...weekData };
    Object.entries(weekData).forEach(([slotKey, slotData]) => {
      if (!slotData || typeof slotData !== 'object') return;
      let slotChanged = false;
      const nextSlot = { ...slotData };
      ['released_uids', 'claimed_uids', 'waitlist_uids', 'request_uids'].forEach((key) => {
        if (!Array.isArray(slotData[key])) return;
        const { next, changed: arrayChanged } = replaceUidInArray(slotData[key], mapping);
        if (arrayChanged) {
          nextSlot[key] = next;
          slotChanged = true;
        }
      });
      ['released_meta', 'claimed_meta', 'waitlist_meta', 'request_meta'].forEach((key) => {
        if (!slotData[key]) return;
        const { map: nextMap, changed: mapChanged } = replaceUidInMap(slotData[key], mapping);
        if (mapChanged) {
          nextSlot[key] = nextMap;
          slotChanged = true;
        }
      });
      if (slotChanged) {
        nextWeek[slotKey] = nextSlot;
        weekChanged = true;
      }
    });
    if (weekChanged) {
      nextAttendance[weekKey] = nextWeek;
      attendanceChanged = true;
    }
  });
  if (attendanceChanged) {
    updates.attendance = nextAttendance;
    changed = true;
  }

  return { changed, updates };
};

const dryRun = !process.argv.includes('--apply');

const run = async () => {
  const usersSnapshot = await db.collection('users').get();
  const users = usersSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  const grouped = new Map();

  users.forEach((user) => {
    const email = normalizeEmail(user.email);
    if (!email) return;
    if (user.merged_into) return;
    if (!grouped.has(email)) grouped.set(email, []);
    grouped.get(email).push(user);
  });

  const mergePlans = [];

  for (const [email, list] of grouped.entries()) {
    if (list.length < 2) continue;
    let authUser = null;
    try {
      authUser = await auth.getUserByEmail(email);
    } catch {
      authUser = null;
    }

    let target = null;
    if (authUser) {
      target = list.find((user) => user.id === authUser.uid) || null;
    }
    if (!target) {
      target = [...list].sort((a, b) => getUserSortScore(b) - getUserSortScore(a))[0];
    }

    const legacyUsers = list.filter((user) => user.id !== target.id);
    if (legacyUsers.length === 0) continue;
    const patch = buildProfilePatch(target, legacyUsers);

    mergePlans.push({
      email,
      target,
      legacyUsers,
      patch
    });
  }

  if (mergePlans.length === 0) {
    console.log('No duplicate emails found.');
    return;
  }

  console.log(`Found ${mergePlans.length} duplicate email group(s).`);

  if (dryRun) {
    mergePlans.slice(0, 20).forEach((plan) => {
      console.log('Would merge', plan.email, '->', plan.target.id, 'legacy:', plan.legacyUsers.map((u) => u.id));
    });
    console.log('Dry run complete. Re-run with --apply to perform updates.');
    return;
  }

  const mergeMap = {};
  const legacyLookup = {};
  mergePlans.forEach((plan) => {
    plan.legacyUsers.forEach((legacy) => {
      mergeMap[legacy.id] = plan.target.id;
      legacyLookup[legacy.id] = legacy;
    });
  });

  const batchSize = 400;
  let batch = db.batch();
  let batchCount = 0;

  const commitBatch = async () => {
    if (batchCount === 0) return;
    await batch.commit();
    batch = db.batch();
    batchCount = 0;
  };

  for (const plan of mergePlans) {
    const targetRef = db.collection('users').doc(plan.target.id);
    if (Object.keys(plan.patch).length > 0) {
      batch.update(targetRef, plan.patch);
      batchCount += 1;
    }

    plan.legacyUsers.forEach((legacy) => {
      const legacyRef = db.collection('users').doc(legacy.id);
      batch.update(legacyRef, {
        merged_into: plan.target.id,
        merged_at: new Date().toISOString()
      });
      batchCount += 1;
    });

    if (batchCount >= batchSize) {
      await commitBatch();
    }
  }

  await commitBatch();

  const trainingGroupsSnapshot = await db.collection('training_groups').get();
  for (const docSnap of trainingGroupsSnapshot.docs) {
    const group = { id: docSnap.id, ...docSnap.data() };
    const { changed, updates } = applyMappingToTrainingGroup(group, mergeMap);
    if (changed) {
      await docSnap.ref.update(updates);
    }
  }

  if (Object.keys(mergeMap).length > 0) {
    const leaderboardSnapshot = await db.collection('leaderboard_entries').get();
    for (const docSnap of leaderboardSnapshot.docs) {
      const entry = docSnap.data();
      const mapped = mergeMap[entry.player_uid];
      if (mapped && mapped !== entry.player_uid) {
        await docSnap.ref.update({ player_uid: mapped });
      }
    }

    const gamesSnapshot = await db.collection('games').get();
    for (const docSnap of gamesSnapshot.docs) {
      const game = docSnap.data();
      if (game?.player_uids && typeof game.player_uids === 'object') {
        let changed = false;
        const nextPlayerUids = { ...game.player_uids };
        Object.entries(nextPlayerUids).forEach(([playerName, uid]) => {
          const mapped = mergeMap[uid];
          if (mapped && mapped !== uid) {
            nextPlayerUids[playerName] = mapped;
            changed = true;
          }
        });
        if (changed) {
          await docSnap.ref.update({ player_uids: nextPlayerUids });
        }
      }
    }

    const duelSnapshot = await db.collection('duel_games').get();
    for (const docSnap of duelSnapshot.docs) {
      const duel = docSnap.data();
      const mapped = mergeMap[duel?.winner_id];
      if (mapped && mapped !== duel.winner_id) {
        await docSnap.ref.update({ winner_id: mapped });
      }
    }
  }

  console.log('Merge complete.');
};

run().catch((error) => {
  console.error('Merge failed:', error);
  process.exit(1);
});
