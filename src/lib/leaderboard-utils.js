import { base44 } from '@/api/base44Client';

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function getCacheMap(cache, key) {
  if (!cache[key]) {
    cache[key] = new Map();
  }
  return cache[key];
}

async function getUserByUid(uid, cache) {
  if (!uid) return null;
  const byUid = getCacheMap(cache, 'byUid');
  if (byUid.has(uid)) return byUid.get(uid);

  let user = null;
  try {
    user = await base44.entities.User.get(uid);
  } catch {
    const users = await base44.entities.User.filter({ id: uid });
    user = users?.[0] || null;
  }
  byUid.set(uid, user);

  if (user?.email) {
    const byEmail = getCacheMap(cache, 'byEmail');
    byEmail.set(normalizeEmail(user.email), user);
  }

  return user;
}

async function getUserByEmail(email, cache) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const byEmail = getCacheMap(cache, 'byEmail');
  if (byEmail.has(normalized)) return byEmail.get(normalized);

  const users = await base44.entities.User.filter({ email: normalized });
  const user = users?.[0] || null;
  byEmail.set(normalized, user);

  if (user?.id) {
    const byUid = getCacheMap(cache, 'byUid');
    byUid.set(user.id, user);
  }

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
  if (playerEmail) return { player_email: normalizeEmail(playerEmail) };
  return { player_name: playerName };
}

export async function resolveLeaderboardPlayer({ game, playerName, cache = {} }) {
  const mappedUid = game?.player_uids?.[playerName];
  const mappedEmail = normalizeEmail(game?.player_emails?.[playerName]);

  let user = await getUserByUid(mappedUid, cache);
  if (!user && mappedEmail) {
    user = await getUserByEmail(mappedEmail, cache);
  }

  const resolvedName = user?.full_name?.trim() || playerName;
  const resolvedUid = user?.id || mappedUid;
  const resolvedEmail = normalizeEmail(user?.email || mappedEmail);

  return {
    playerName: resolvedName,
    playerUid: resolvedUid || undefined,
    playerEmail: resolvedEmail || undefined,
    playerGender: normalizeLeaderboardGender(user?.gender)
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

  const pageSize = 100;
  let skip = 0;
  const entryIds = [];

  while (true) {
    const chunk = await base44.entities.LeaderboardEntry.filter({ game_id: gameId }, '-created_date', pageSize, skip);
    if (!chunk?.length) break;
    entryIds.push(...chunk.map((entry) => entry.id).filter(Boolean));
    if (chunk.length < pageSize) break;
    skip += chunk.length;
  }

  for (const id of entryIds) {
    await base44.entities.LeaderboardEntry.delete(id);
  }

  await base44.entities.Game.delete(gameId);
}
