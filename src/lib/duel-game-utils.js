export const createRandomDuelPin = () =>
  Math.floor(1000 + Math.random() * 9000).toString();

const normalizeString = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

const toTimestamp = (value) => {
  const parsed = value ? Date.parse(value) : NaN;
  if (Number.isFinite(parsed)) return parsed;
  return 0;
};

export const sortDuelGamesByNewest = (games = []) => (
  [...games].sort((a, b) => {
    const bTime = toTimestamp(b?.created_at || b?.date);
    const aTime = toTimestamp(a?.created_at || a?.date);
    if (bTime !== aTime) return bTime - aTime;
    return String(b?.id || '').localeCompare(String(a?.id || ''));
  })
);

export const pickJoinableDuelGame = (games = []) => {
  const ordered = sortDuelGamesByNewest(games);
  return ordered.find((game) => game?.status !== 'finished') || ordered[0] || null;
};

export const buildDuelParticipantFields = (state) => {
  const players = Object.values(state?.players || {});
  const participantUids = Array.from(new Set(
    players
      .map((player) => player?.id)
      .filter((id) => typeof id === 'string' && id.trim().length > 0)
  ));
  const participantEmails = Array.from(new Set(
    players
      .map((player) => normalizeString(player?.email))
      .filter(Boolean)
  ));
  const participantNames = Array.from(new Set(
    players
      .map((player) => (typeof player?.name === 'string' ? player.name.trim() : ''))
      .filter(Boolean)
  ));

  return {
    participant_uids: participantUids,
    participant_emails: participantEmails,
    participant_names: participantNames
  };
};

export const isUserInDuelGame = (game, user) => {
  if (!game || !user) return false;
  const userId = user?.id;
  const userEmail = normalizeString(user?.email);
  const userDisplayName = normalizeString(user?.display_name);
  const userFullName = normalizeString(user?.full_name);

  if (userId && (game.participant_uids || []).includes(userId)) return true;
  if (userEmail && (game.participant_emails || []).map(normalizeString).includes(userEmail)) return true;

  const players = Object.values(game.state?.players || {});
  return players.some((player) => {
    const playerId = player?.id;
    const playerEmail = normalizeString(player?.email);
    const playerName = normalizeString(player?.name);

    if (userId && playerId === userId) return true;
    if (userEmail && playerEmail === userEmail) return true;
    if (userDisplayName && playerName === userDisplayName) return true;
    if (userFullName && playerName === userFullName) return true;
    return false;
  });
};
