export const DUEL_START_DISTANCE = 5;
export const DUEL_MAX_DISTANCE = 10;

const cloneState = (state) => JSON.parse(JSON.stringify(state || {}));

export const createEmptyDuelState = (stationCount = 1) => ({
  players: {},
  stations: Array.from({ length: stationCount }, (_, index) => ({
    index: index + 1,
    players: [],
    round_id: 0,
    last_resolved_round: 0
  })),
  queue: [],
  pending: {},
  log: []
});

const ensureStations = (state, stationCount) => {
  if (!state.stations || state.stations.length !== stationCount) {
    state.stations = Array.from({ length: stationCount }, (_, index) => ({
      index: index + 1,
      players: [],
      round_id: 0,
      last_resolved_round: 0
    }));
  }
};

const removeFromArray = (arr, value) => arr.filter((item) => item !== value);

export const addPlayerToState = (state, player) => {
  if (state.players[player.id]) return state;
  state.players[player.id] = {
    id: player.id,
    name: player.name,
    email: player.email || null,
    joined_at: player.joined_at || new Date().toISOString(),
    station_index: null,
    distance: DUEL_START_DISTANCE,
    points: 0,
    wins: 0,
    losses: 0,
    ready: false,
    status: 'waiting',
    desired_station: player.desired_station ?? null
  };
  if (!state.queue.includes(player.id)) {
    state.queue.push(player.id);
  }
  return state;
};

const assignPlayerToStation = (state, playerId, stationIndex) => {
  const station = state.stations.find((s) => s.index === stationIndex);
  if (!station || station.players.length >= 2) return false;
  if (!station.players.includes(playerId)) {
    station.players.push(playerId);
  }
  const player = state.players[playerId];
  if (player) {
    player.station_index = stationIndex;
    player.status = 'station';
    player.ready = false;
    player.distance = DUEL_START_DISTANCE;
    player.desired_station = stationIndex;
  }
  return true;
};

const enqueuePlayer = (state, playerId, desiredStation) => {
  const player = state.players[playerId];
  if (player) {
    player.status = 'waiting';
    player.station_index = null;
    player.ready = false;
    player.desired_station = desiredStation;
  }
  if (!state.queue.includes(playerId)) {
    state.queue.push(playerId);
  }
};

const removePlayerFromStation = (state, playerId) => {
  const player = state.players[playerId];
  if (!player?.station_index) return;
  const station = state.stations.find((s) => s.index === player.station_index);
  if (station) {
    station.players = removeFromArray(station.players, playerId);
  }
  player.station_index = null;
};

const fillStationsFromQueue = (state) => {
  state.stations.forEach((station) => {
    while (station.players.length < 2) {
      const candidateIndex = state.queue.findIndex(
        (playerId) => state.players[playerId]?.desired_station === station.index
      );
      if (candidateIndex === -1) break;
      const [playerId] = state.queue.splice(candidateIndex, 1);
      assignPlayerToStation(state, playerId, station.index);
    }
  });
};

export const initializeDuelGameState = (game) => {
  const nextState = createEmptyDuelState(game.station_count || 1);
  const players = game.state?.players || {};
  Object.values(players).forEach((player) => {
    nextState.players[player.id] = {
      ...player,
      station_index: null,
      distance: DUEL_START_DISTANCE,
      ready: false,
      status: 'waiting',
      desired_station: null
    };
    nextState.queue.push(player.id);
  });
  return nextState;
};

export const startDuelGame = (game) => {
  const stationCount = game.station_count || 1;
  const state = initializeDuelGameState(game);
  ensureStations(state, stationCount);

  const playerIds = Object.values(state.players)
    .sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime())
    .map((player) => player.id);

  state.queue = [];
  let playerIndex = 0;

  state.stations.forEach((station) => {
    while (station.players.length < 2 && playerIndex < playerIds.length) {
      const playerId = playerIds[playerIndex];
      playerIndex += 1;
      assignPlayerToStation(state, playerId, station.index);
    }
  });

  for (; playerIndex < playerIds.length; playerIndex += 1) {
    enqueuePlayer(state, playerIds[playerIndex], stationCount);
  }

  return state;
};

export const markPlayerReady = (state, playerId) => {
  const next = cloneState(state);
  if (next.players?.[playerId]) {
    next.players[playerId].ready = true;
  }
  return next;
};

export const undoSubmission = (game, stationIndex, playerId) => {
  const stationCount = game.station_count || 1;
  const nextGame = { ...game };
  const nextState = cloneState(game.state || createEmptyDuelState(stationCount));
  const pending = nextState.pending?.[stationIndex];
  if (!pending?.submissions?.[playerId]) {
    nextGame.state = nextState;
    return nextGame;
  }

  const isSoloMode = game.mode === 'solo' && stationCount === 1;
  if (isSoloMode && pending.resolved && pending.snapshot) {
    const snapshotPlayers = pending.snapshot.players || {};
    Object.entries(snapshotPlayers).forEach(([id, data]) => {
      if (nextState.players?.[id]) {
        nextState.players[id] = { ...nextState.players[id], ...data };
      }
    });
    nextGame.status = pending.snapshot.gameStatus || nextGame.status;
    nextGame.winner_id = pending.snapshot.winnerId || null;
    nextGame.ended_at = pending.snapshot.endedAt || null;
  }

  delete pending.submissions[playerId];
  pending.resolved = false;
  delete pending.snapshot;

  if (Object.keys(pending.submissions).length === 0) {
    delete nextState.pending[stationIndex];
  }

  nextGame.state = nextState;
  return nextGame;
};

export const submitDuelScore = (game, playerId, made) => {
  const stationCount = game.station_count || 1;
  const nextGame = { ...game };
  const nextState = cloneState(game.state || createEmptyDuelState(stationCount));
  ensureStations(nextState, stationCount);

  const player = nextState.players?.[playerId];
  if (!player || !player.station_index) {
    return nextGame;
  }

  const stationIndex = player.station_index;
  const station = nextState.stations.find((s) => s.index === stationIndex);
  if (!station || station.players.length < 2) {
    return nextGame;
  }

  const opponentId = station.players.find((id) => id !== playerId);
  const opponent = opponentId ? nextState.players[opponentId] : null;
  if (!opponent || !player.ready || !opponent.ready) {
    return nextGame;
  }

  if (!nextState.pending) nextState.pending = {};
  const pending = nextState.pending[stationIndex] || {
    round_id: station.round_id + 1,
    submissions: {}
  };

  const isSoloMode = game.mode === 'solo' && stationCount === 1;
  const hasPlayerSubmission = Boolean(pending.submissions?.[playerId]);
  const hasOpponentSubmission = Boolean(opponentId && pending.submissions?.[opponentId]);
  const playerDistanceChanged =
    hasPlayerSubmission && pending.submissions[playerId]?.distance !== player.distance;
  const opponentDistanceChanged =
    hasOpponentSubmission && pending.submissions[opponentId]?.distance !== opponent?.distance;

  if (pending.resolved && (playerDistanceChanged || opponentDistanceChanged)) {
    pending.submissions = {};
    pending.round_id = station.round_id + 1;
    pending.resolved = false;
    delete pending.snapshot;
  }

  if (isSoloMode && pending.resolved && pending.snapshot) {
    const snapshotPlayers = pending.snapshot.players || {};
    Object.entries(snapshotPlayers).forEach(([id, data]) => {
      if (nextState.players?.[id]) {
        nextState.players[id] = { ...nextState.players[id], ...data };
      }
    });
    nextGame.status = pending.snapshot.gameStatus || nextGame.status;
    nextGame.winner_id = pending.snapshot.winnerId || null;
    nextGame.ended_at = pending.snapshot.endedAt || null;
    pending.resolved = false;
    delete pending.snapshot;
  }

  pending.submissions[playerId] = {
    made,
    distance: player.distance,
    submitted_at: new Date().toISOString()
  };

  nextState.pending[stationIndex] = pending;

  const submissions = pending.submissions;
  if (!submissions[playerId] || !submissions[opponentId]) {
    nextGame.state = nextState;
    return nextGame;
  }

  const roundId = pending.round_id;
  if (!isSoloMode && roundId <= station.last_resolved_round) {
    nextGame.state = nextState;
    return nextGame;
  }

  const playerMade = submissions[playerId].made;
  const opponentMade = submissions[opponentId].made;
  const playerDistance = submissions[playerId].distance;
  const opponentDistance = submissions[opponentId].distance;

  station.round_id = roundId;
  station.last_resolved_round = roundId;

  if (isSoloMode) {
    pending.snapshot = {
      gameStatus: nextGame.status,
      winnerId: nextGame.winner_id || null,
      endedAt: nextGame.ended_at || null,
      players: {
        [playerId]: {
          distance: nextState.players[playerId]?.distance,
          points: nextState.players[playerId]?.points,
          wins: nextState.players[playerId]?.wins,
          losses: nextState.players[playerId]?.losses,
          station_index: nextState.players[playerId]?.station_index,
          status: nextState.players[playerId]?.status,
          ready: nextState.players[playerId]?.ready
        },
        [opponentId]: {
          distance: nextState.players[opponentId]?.distance,
          points: nextState.players[opponentId]?.points,
          wins: nextState.players[opponentId]?.wins,
          losses: nextState.players[opponentId]?.losses,
          station_index: nextState.players[opponentId]?.station_index,
          status: nextState.players[opponentId]?.status,
          ready: nextState.players[opponentId]?.ready
        }
      }
    };
  }

  const logEntry = {
    id: `${stationIndex}-${roundId}`,
    ts: new Date().toISOString(),
    station: stationIndex,
    players: [playerId, opponentId],
    scores: {
      [playerId]: playerMade,
      [opponentId]: opponentMade
    },
    distances: {
      [playerId]: playerDistance,
      [opponentId]: opponentDistance
    }
  };

  if (playerMade === opponentMade) {
    logEntry.result = 'tie';
    const nextLog = (nextState.log || []).filter((entry) => entry.id !== logEntry.id);
    nextState.log = [...nextLog, logEntry];
    pending.resolved = true;
    if (!isSoloMode) {
      delete nextState.pending[stationIndex];
    }
    nextGame.state = nextState;
    return nextGame;
  }

  const winnerId = playerMade > opponentMade ? playerId : opponentId;
  const loserId = winnerId === playerId ? opponentId : playerId;
  const winnerDistance = winnerId === playerId ? playerDistance : opponentDistance;
  const winner = nextState.players[winnerId];
  const loser = nextState.players[loserId];

  const pointsAwarded = winnerDistance >= DUEL_MAX_DISTANCE ? 2 : 1;
  winner.points += pointsAwarded;
  winner.wins += 1;
  loser.losses += 1;

  logEntry.result = winnerId;
  logEntry.points = pointsAwarded;
  const nextLog = (nextState.log || []).filter((entry) => entry.id !== logEntry.id);
  nextState.log = [...nextLog, logEntry];

  if (winnerDistance >= DUEL_MAX_DISTANCE) {
    if (game.mode === 'solo' && stationCount === 1) {
      nextGame.status = 'finished';
      nextGame.ended_at = new Date().toISOString();
      nextGame.winner_id = winnerId;
      pending.resolved = true;
      if (!isSoloMode) {
        delete nextState.pending[stationIndex];
      }
      nextGame.state = nextState;
      return nextGame;
    }

    const winnerTarget = Math.max(1, stationIndex - 1);
    const loserTarget = Math.min(stationCount, stationIndex + 1);

    removePlayerFromStation(nextState, winnerId);
    removePlayerFromStation(nextState, loserId);

    if (!assignPlayerToStation(nextState, winnerId, winnerTarget)) {
      enqueuePlayer(nextState, winnerId, winnerTarget);
    }

    if (!assignPlayerToStation(nextState, loserId, loserTarget)) {
      enqueuePlayer(nextState, loserId, loserTarget);
    }

    fillStationsFromQueue(nextState);
  } else {
    winner.distance = Math.min(DUEL_MAX_DISTANCE, winner.distance + 1);
  }

  pending.resolved = true;
  if (!isSoloMode) {
    delete nextState.pending[stationIndex];
  }
  nextGame.state = nextState;
  return nextGame;
};

export const getStationPlayers = (state, stationIndex) => {
  const station = state?.stations?.find((s) => s.index === stationIndex);
  return station?.players || [];
};

export const getOpponentId = (state, playerId) => {
  const player = state?.players?.[playerId];
  if (!player?.station_index) return null;
  const station = state.stations.find((s) => s.index === player.station_index);
  return station?.players?.find((id) => id !== playerId) || null;
};

export const hasPendingSubmission = (state, stationIndex, playerId) => {
  return Boolean(state?.pending?.[stationIndex]?.submissions?.[playerId]);
};

export const isStationReady = (state, stationIndex) => {
  const station = state?.stations?.find((s) => s.index === stationIndex);
  if (!station || station.players.length < 2) return false;
  return station.players.every((id) => state.players?.[id]?.ready);
};

export const getLeaderboardRows = (state) => {
  return Object.values(state?.players || {})
    .map((player) => ({
      id: player.id,
      name: player.name,
      points: player.points,
      wins: player.wins,
      losses: player.losses,
      station: player.station_index || '-'
    }))
    .sort((a, b) => b.points - a.points);
};
