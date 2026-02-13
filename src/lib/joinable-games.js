const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : 0;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value === 'object' && typeof value.seconds === 'number') {
    return value.seconds * 1000;
  }
  return 0;
};

const normalizeStatus = (value) => String(value || '').trim().toLowerCase();

export const isJoinableRegularGame = (game) => {
  const status = normalizeStatus(game?.status);
  return Boolean(
    game?.pin &&
    game.pin !== '0000' &&
    game.join_closed !== true &&
    status !== 'closed' &&
    status !== 'completed' &&
    status !== 'finished'
  );
};

export const isJoinableDuelGame = (game) => {
  const status = normalizeStatus(game?.status);
  return Boolean(
    game?.pin &&
    game.pin !== '0000' &&
    status !== 'finished' &&
    status !== 'closed' &&
    status !== 'cancelled'
  );
};

export const createJoinableRegularEntries = (games = []) => (
  (games || [])
    .filter(isJoinableRegularGame)
    .map((game) => ({
      ...game,
      __kind: 'regular',
      __sortDate: game?.date || game?.created_date || null,
      __sortTs: toMillis(game?.date || game?.created_date),
      __entryKey: `regular:${game?.id || `${game?.pin || 'no-pin'}:${toMillis(game?.date || game?.created_date)}`}`
    }))
);

export const createJoinableDuelEntries = (games = []) => (
  (games || [])
    .filter(isJoinableDuelGame)
    .map((game) => ({
      ...game,
      __kind: 'duel',
      __sortDate: game?.created_at || game?.started_at || game?.date || game?.created_date || null,
      __sortTs: toMillis(game?.created_at || game?.started_at || game?.date || game?.created_date),
      __entryKey: `duel:${game?.id || `${game?.pin || 'no-pin'}:${toMillis(game?.created_at || game?.started_at || game?.date || game?.created_date)}`}`
    }))
);

export const buildJoinableEntries = ({ hostedGames = [], duelGames = [], limit = 10 } = {}) => {
  const regularEntries = createJoinableRegularEntries(hostedGames);
  const duelEntries = createJoinableDuelEntries(duelGames);

  return [...regularEntries, ...duelEntries]
    .sort((a, b) => {
      const tsDelta = (b.__sortTs || 0) - (a.__sortTs || 0);
      if (tsDelta !== 0) return tsDelta;
      return String(b?.id || '').localeCompare(String(a?.id || ''));
    })
    .slice(0, Math.max(1, Number(limit) || 10));
};

export const toJoinableEntrySummary = (entry) => ({
  id: entry?.id,
  name: entry?.name || (entry?.__kind === 'duel' ? (entry?.mode === 'solo' ? 'SOLO duell' : 'HOST duell') : 'Mäng'),
  pin: entry?.pin,
  kind: entry?.__kind || 'regular',
  status: entry?.status,
  date: entry?.__sortTs || toMillis(entry?.__sortDate || entry?.date || entry?.created_date)
});

export { toMillis };
