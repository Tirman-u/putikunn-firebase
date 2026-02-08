import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, writeBatch, doc, deleteDoc, getDoc } from 'firebase/firestore';

function normalizeEmail(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

function getCacheMap(cache, key) {
  if (!cache[key]) {
    cache[key] = new Map();
  }
  return cache[key];
}

async function getUserByUid(uid, cache) {
  const cacheMap = getCacheMap(cache, 'user_by_uid');
  if (cacheMap.has(uid)) {
    return cacheMap.get(uid);
  }
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  const user = userSnap.exists() ? { id: userSnap.id, ...userSnap.data() } : null;
  cacheMap.set(uid, user);
  return user;
}

async function getUserByEmail(email, cache) {
  const normalizedEmail = normalizeEmail(email);
  const cacheMap = getCacheMap(cache, 'user_by_email');
  if (cacheMap.has(normalizedEmail)) {
    return cacheMap.get(normalizedEmail);
  }
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('email', '==', normalizedEmail));
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) {
    cacheMap.set(normalizedEmail, null);
    return null;
  }
  const user = { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() };
  cacheMap.set(normalizedEmail, user);
  return user;
}

export function normalizeLeaderboardGender(gender) {
  return gender === 'N' ? 'N' : undefined;
}

export function isHostedGame(game) {
  return Boolean(game?.pin && game.pin !== '0000');
}

export function isHostedClassicGame(game) {
  return isHostedGame(game) && game?.game_type === 'classic';
}

export function buildLeaderboardIdentityFilter({ playerUid, playerEmail, playerName }) {
  if (playerUid) return { player_uid: playerUid };
  if (playerEmail) return { player_email: playerEmail.trim().toLowerCase() };
  return { player_name: playerName };
}

export function getLeaderboardEmail(resolvedPlayer) {
  return resolvedPlayer?.playerEmail || 'unknown';
}

export async function resolveLeaderboardPlayer({ game, playerName, cache = {} }) {
  const playerUids = game?.player_uids || {};
  const playerEmails = game?.player_emails || {};
  const uid = playerUids[playerName];
  const email = playerEmails[playerName];

  if (uid) {
    const user = await getUserByUid(uid, cache);
    if (user) {
      return {
        playerName: user.displayName || user.fullName || playerName,
        playerUid: uid,
        playerEmail: user.email,
        playerGender: normalizeLeaderboardGender(user.gender)
      };
    }
  }

  if (email) {
    const user = await getUserByEmail(email, cache);
    if (user) {
      return {
        playerName: user.displayName || user.fullName || playerName,
        playerUid: user.id,
        playerEmail: email,
        playerGender: normalizeLeaderboardGender(user.gender)
      };
    }
  }

  return {
    playerName,
    playerUid: undefined,
    playerEmail: undefined,
    playerGender: undefined
  };
}

export function getLeaderboardStats(game, playerName) {
    if (game?.game_type === 'around_the_world') {
        const state = game?.atw_state?.[playerName] || {};
        const currentScore = game?.total_points?.[playerName] || 0;
        const score = Math.max(state?.best_score || 0, currentScore);
        const madePutts = state?.total_makes || 0;
        const totalPutts = state?.total_putts || 0;
        const currentAccuracy = totalPutts > 0 ? (madePutts / totalPutts) * 100 : 0;
        const accuracy = Math.max(state?.best_accuracy || 0, currentAccuracy);
        return { score, madePutts, totalPutts, accuracy };
    }

    const putts = game?.player_putts?.[playerName] || [];
    const madePutts = putts.filter((putt) => putt.result === 'made').length;
    const totalPutts = putts.length;
    const accuracy = totalPutts > 0 ? (madePutts / totalPutts) * 100 : 0;
    const score = game?.total_points?.[playerName] || 0;
    return { score, madePutts, totalPutts, accuracy };
}

export async function deleteGameAndLeaderboardEntries(gameId) {
  if (!gameId) return;

  const entriesRef = collection(db, 'leaderboard_entries');
  const q = query(entriesRef, where('game_id', '==', gameId));
  const querySnapshot = await getDocs(q);

  if (!querySnapshot.empty) {
    const batch = writeBatch(db);
    querySnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  }

  const gameDocRef = doc(db, 'games', gameId);
  await deleteDoc(gameDocRef);
}
