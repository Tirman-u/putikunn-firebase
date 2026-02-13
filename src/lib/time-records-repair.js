import { base44 } from '@/api/base44Client';
import {
  getLeaderboardEmail,
  getLeaderboardStats,
  resolveLeaderboardPlayer
} from '@/lib/leaderboard-utils';

const MAX_FETCH = 2000;
const FETCH_BATCH_SIZE = 200;

const normalizeText = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

const getPlayerKey = (entry) => {
  if (entry?.player_uid) return `uid:${entry.player_uid}`;

  const email = normalizeText(entry?.player_email);
  if (email && email !== 'unknown') {
    return `email:${email}`;
  }

  const resolvedName = normalizeText(entry?.player_name);
  if (resolvedName) return `name:${resolvedName}`;

  return `id:${entry?.id || 'unknown'}`;
};

const getResolvedPlayerKey = (resolvedPlayer) => {
  if (resolvedPlayer?.playerUid) return `uid:${resolvedPlayer.playerUid}`;
  const email = normalizeText(resolvedPlayer?.playerEmail);
  if (email && email !== 'unknown') return `email:${email}`;
  const name = normalizeText(resolvedPlayer?.playerName);
  if (name) return `name:${name}`;
  return '';
};

const resolveGamePlayers = (game) => {
  const players = new Set();
  (game?.players || []).forEach((name) => players.add(name));
  Object.keys(game?.total_points || {}).forEach((name) => players.add(name));
  Object.keys(game?.player_uids || {}).forEach((name) => players.add(name));
  Object.keys(game?.player_emails || {}).forEach((name) => players.add(name));
  Object.keys(game?.live_stats || {}).forEach((name) => players.add(name));
  return Array.from(players).filter(Boolean);
};

const fetchRows = async (entityApi, filter, sortOrder) => {
  const rows = [];
  let skip = 0;

  while (rows.length < MAX_FETCH) {
    const limit = Math.min(FETCH_BATCH_SIZE, MAX_FETCH - rows.length);
    const chunk = await entityApi.filter(filter, sortOrder, limit, skip);
    if (!chunk?.length) break;

    rows.push(...chunk);
    skip += chunk.length;

    if (chunk.length < limit) break;
  }

  return rows;
};

export async function repairTimeLadderRecords() {
  const timeGames = await fetchRows(base44.entities.Game, { game_type: 'time_ladder' }, '-date');
  const existingEntries = await fetchRows(
    base44.entities.LeaderboardEntry,
    { leaderboard_type: 'general', game_type: 'time_ladder' },
    'score'
  );

  const timeGamesById = {};
  timeGames.forEach((game) => {
    if (game?.id) {
      timeGamesById[game.id] = game;
    }
  });

  let fixedDiscs = 0;
  for (const entry of existingEntries) {
    const directDiscs = Number(entry?.time_ladder_discs_per_turn);
    if (Number.isFinite(directDiscs) && directDiscs > 0) continue;
    const game = timeGamesById[entry?.game_id];
    const gameDiscs = Number(game?.time_ladder_config?.discs_per_turn);
    if (!Number.isFinite(gameDiscs) || gameDiscs <= 0) continue;
    await base44.entities.LeaderboardEntry.update(entry.id, {
      time_ladder_discs_per_turn: gameDiscs
    });
    entry.time_ladder_discs_per_turn = gameDiscs;
    fixedDiscs += 1;
  }

  const getEntryDiscs = (entry) => {
    const directDiscs = Number(entry?.time_ladder_discs_per_turn);
    if (Number.isFinite(directDiscs) && directDiscs > 0) return directDiscs;
    const gameDiscs = Number(timeGamesById[entry?.game_id]?.time_ladder_config?.discs_per_turn);
    if (Number.isFinite(gameDiscs) && gameDiscs > 0) return gameDiscs;
    return null;
  };

  const signatureForExisting = (entry) => `${getPlayerKey(entry)}|game:${entry?.game_id || 'unknown'}|discs:${getEntryDiscs(entry) || 'unknown'}`;
  const entriesBySignature = new Map();
  let removedDuplicates = 0;

  for (const entry of existingEntries) {
    const signature = signatureForExisting(entry);
    const current = entriesBySignature.get(signature);
    if (!current) {
      entriesBySignature.set(signature, entry);
      continue;
    }

    const entryScore = Number(entry?.score || 0);
    const currentScore = Number(current?.score || 0);
    const entryDate = new Date(entry?.date || 0).getTime();
    const currentDate = new Date(current?.date || 0).getTime();
    const entryIsBetter = entryScore < currentScore || (entryScore === currentScore && entryDate > currentDate);

    if (entryIsBetter) {
      if (current?.id) {
        await base44.entities.LeaderboardEntry.delete(current.id);
        removedDuplicates += 1;
      }
      entriesBySignature.set(signature, entry);
    } else if (entry?.id) {
      await base44.entities.LeaderboardEntry.delete(entry.id);
      removedDuplicates += 1;
    }
  }

  const profileCache = {};
  let created = 0;
  let updated = 0;

  for (const game of timeGames) {
    const discs = Number(game?.time_ladder_config?.discs_per_turn);
    const gamePlayers = resolveGamePlayers(game);

    for (const rawPlayerName of gamePlayers) {
      const stats = getLeaderboardStats(game, rawPlayerName);
      const score = Number(stats?.score || 0);
      if (!Number.isFinite(score) || score <= 0) continue;

      const resolvedPlayer = await resolveLeaderboardPlayer({
        game,
        playerName: rawPlayerName,
        cache: profileCache
      });
      const identityKey = getResolvedPlayerKey(resolvedPlayer);
      if (!identityKey) continue;

      const payload = {
        game_id: game.id,
        player_name: resolvedPlayer.playerName,
        ...(resolvedPlayer.playerUid ? { player_uid: resolvedPlayer.playerUid } : {}),
        player_email: getLeaderboardEmail(resolvedPlayer),
        ...(resolvedPlayer.playerGender ? { player_gender: resolvedPlayer.playerGender } : {}),
        game_type: 'time_ladder',
        score,
        accuracy: Math.round((Number(stats?.accuracy || 0)) * 10) / 10,
        made_putts: Number(stats?.madePutts || 0),
        total_putts: Number(stats?.totalPutts || 0),
        ...(Number.isFinite(discs) && discs > 0 ? { time_ladder_discs_per_turn: discs } : {}),
        leaderboard_type: 'general',
        date: new Date(game.date || new Date().toISOString()).toISOString()
      };

      const signature = `${identityKey}|game:${game.id}|discs:${Number.isFinite(discs) && discs > 0 ? discs : 'unknown'}`;
      const existing = entriesBySignature.get(signature);

      if (!existing?.id) {
        const createdEntry = await base44.entities.LeaderboardEntry.create(payload);
        entriesBySignature.set(signature, createdEntry || payload);
        created += 1;
        continue;
      }

      const existingScore = Number(existing.score || 0);
      const existingDate = new Date(existing.date || 0).getTime();
      const payloadDate = new Date(payload.date || 0).getTime();
      const isBetter = score < existingScore || (score === existingScore && payloadDate > existingDate);
      if (isBetter) {
        await base44.entities.LeaderboardEntry.update(existing.id, payload);
        entriesBySignature.set(signature, { ...existing, ...payload });
        updated += 1;
      }
    }
  }

  return {
    scannedGames: timeGames.length,
    fixedDiscs,
    created,
    updated,
    removedDuplicates
  };
}
