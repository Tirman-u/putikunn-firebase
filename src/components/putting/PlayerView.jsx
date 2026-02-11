import React from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Trophy, Upload, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import ClassicScoreInput from './ClassicScoreInput';
import BackAndForthInput from './BackAndForthInput';
import BackAndForthScoreInput from './BackAndForthScoreInput';
import StreakChallengeInput from './StreakChallengeInput';
import MobileLeaderboard from './MobileLeaderboard';
import PerformanceAnalysis from './PerformanceAnalysis';
import useRealtimeGame from '@/hooks/use-realtime-game';
import LoadingState from '@/components/ui/loading-state';
import { logSyncMetric } from '@/lib/metrics';
import usePlayerGameState from '@/hooks/use-player-game-state';
import {
  buildLeaderboardIdentityFilter,
  getLeaderboardEmail,
  resolveLeaderboardPlayer
} from '@/lib/leaderboard-utils';
import { 
  GAME_FORMATS, 
  getNextDistanceFromMade, 
  getNextDistanceBackAndForth,
  calculateRoundScore,
  getTotalRounds,
  isGameComplete 
} from './gameRules';
import BackButton from '@/components/ui/back-button';
import HomeButton from '@/components/ui/home-button';

const PLAYER_STATE_KEYS = [
  'player_putts',
  'total_points',
  'player_distances',
  'player_current_streaks',
  'player_highest_streaks'
];

export default function PlayerView({ gameId, playerName, onExit }) {
  const [showLeaderboard, setShowLeaderboard] = React.useState(false);
  const [hasSubmitted, setHasSubmitted] = React.useState(false);
  const [streakDistanceSelected, setStreakDistanceSelected] = React.useState(false);
  const [hideScore, setHideScore] = React.useState(false);
  const [streakComplete, setStreakComplete] = React.useState(false);
  const [localGameState, setLocalGameState] = React.useState(null);
  const localGameStateRef = React.useRef(null);
  const MULTIPLAYER_SYNC_INTERVAL_MS = 30000;
  const MULTIPLAYER_SYNC_DEBOUNCE_MS = 300;
  const LIVE_SYNC_DEBOUNCE_MS = 200;
  const pendingUpdateRef = React.useRef(null);
  const pendingLiveRef = React.useRef(null);
  const syncTimeoutRef = React.useRef(null);
  const liveTimeoutRef = React.useRef(null);
  const syncInFlightRef = React.useRef(false);
  const flushPendingRef = React.useRef(null);
  const flushLivePendingRef = React.useRef(null);
  const queuedSyncRef = React.useRef(null);
  const queuedLiveRef = React.useRef(null);
  const lastSyncAtRef = React.useRef(0);
  const turnsSinceSyncRef = React.useRef(0);
  const gameIdRef = React.useRef(gameId);
  const baseGameRef = React.useRef(null);
  const lastLoadedGameIdRef = React.useRef(null);
  const hydratedFromStorageRef = React.useRef(false);
  const queryClient = useQueryClient();

  React.useEffect(() => {
    gameIdRef.current = gameId;
  }, [gameId]);

  const { user, game, isLoading, isSoloGame } = usePlayerGameState({ gameId });
  const soloStorageKey = React.useMemo(() => {
    if (!isSoloGame || !gameId) return null;
    return `putikunn:solo:${gameId}`;
  }, [gameId, isSoloGame]);

  const getLatestState = React.useCallback(() => {
    return localGameStateRef.current || game || {};
  }, [game]);

  const buildRemotePatch = React.useCallback((data) => {
    const patch = { ...data };
    PLAYER_STATE_KEYS.forEach((key) => {
      if (!data?.[key]) {
        delete patch[key];
        return;
      }
      const playerEntry = data[key]?.[playerName];
      if (playerEntry === undefined) {
        delete patch[key];
        return;
      }
      patch[key] = { [playerName]: playerEntry };
    });
    return patch;
  }, [playerName]);

  const mergeWithLatest = React.useCallback((latestGame, patch) => {
    if (!latestGame) return patch;
    const merged = { ...patch };
    PLAYER_STATE_KEYS.forEach((key) => {
      if (patch?.[key]) {
        merged[key] = {
          ...(latestGame[key] || {}),
          ...(patch[key] || {})
        };
      }
    });
    return merged;
  }, []);

  React.useEffect(() => {
    setStreakComplete(false);
  }, [gameId, playerName]);

  React.useEffect(() => {
    localGameStateRef.current = localGameState;
  }, [localGameState]);

  React.useEffect(() => {
    if (!soloStorageKey || !gameId || !isSoloGame) return;
    if (hydratedFromStorageRef.current) return;
    try {
      const stored = localStorage.getItem(soloStorageKey);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (!parsed || (parsed.id && parsed.id !== gameId)) return;
      hydratedFromStorageRef.current = true;
      setLocalGameState(parsed);
      localGameStateRef.current = parsed;
    } catch {
      // ignore storage errors
    }
  }, [gameId, isSoloGame, soloStorageKey]);

  React.useEffect(() => {
    if (!soloStorageKey || !isSoloGame || !localGameState) return;
    if (localGameState.status === 'completed') {
      localStorage.removeItem(soloStorageKey);
      return;
    }
    try {
      localStorage.setItem(soloStorageKey, JSON.stringify(localGameState));
    } catch {
      // ignore storage errors
    }
  }, [isSoloGame, localGameState, soloStorageKey]);

  const mergeIncomingGame = React.useCallback((incoming) => {
    if (!incoming) return localGameStateRef.current || incoming;
    const localState = localGameStateRef.current || {};
    const merged = { ...localState, ...incoming };
    const fallback = baseGameRef.current || localState;
    const staticKeys = ['name', 'pin', 'host_user', 'game_type', 'putt_type', 'status', 'date'];
    staticKeys.forEach((key) => {
      if (merged?.[key] === undefined || merged?.[key] === null) {
        merged[key] = fallback?.[key];
      }
    });
    if (!merged.game_type && localState.game_type) {
      merged.game_type = localState.game_type;
    }
    if (!merged.putt_type && localState.putt_type) {
      merged.putt_type = localState.putt_type;
    }
    if (!merged.status && localState.status) {
      merged.status = localState.status;
    }
    const mapKeys = [
      'player_putts',
      'total_points',
      'player_distances',
      'player_current_streaks',
      'player_highest_streaks'
    ];
    mapKeys.forEach((key) => {
      const incomingMap = incoming[key] || {};
      const localMap = localState[key] || {};
      merged[key] = {
        ...incomingMap,
        ...(localMap[playerName] !== undefined ? { [playerName]: localMap[playerName] } : {})
      };
    });
    return merged;
  }, [playerName]);

  const buildLiveStats = React.useCallback((state) => {
    const putts = state.player_putts?.[playerName] || [];
    const totalPutts = putts.length;
    const madePutts = putts.filter(p => p.result === 'made').length;
    const totalPoints = state.total_points?.[playerName] || 0;
    const gameType = state.game_type || 'classic';
    const potentialMaxScore = gameType === 'streak_challenge'
      ? Math.max(state.player_highest_streaks?.[playerName] || 0, totalPoints)
      : putts.reduce((sum, putt) => sum + (putt?.distance || 0), 0);

    return {
      total_putts: totalPutts,
      made_putts: madePutts,
      total_points: totalPoints,
      potential_max_score: potentialMaxScore,
      updated_at: new Date().toISOString()
    };
  }, [playerName]);

  const buildLivePayload = React.useCallback((payload, id) => {
    const latest = queryClient.getQueryData(['game', id]) || game || {};
    return {
      live_stats: {
        ...(latest.live_stats || {}),
        ...(payload.live_stats || {})
      },
      total_points: {
        ...(latest.total_points || {}),
        ...(payload.total_points || {})
      }
    };
  }, [game, queryClient]);

  useRealtimeGame({
    gameId,
    enabled: !!gameId && game?.pin !== '0000',
    throttleMs: 1000,
    eventTypes: ['update', 'delete'],
    onEvent: (event) => {
      if (!event?.data) return;
      const merged = mergeIncomingGame(event.data);
      setLocalGameState(merged);
      localGameStateRef.current = merged;
      queryClient.setQueryData(['game', gameId], merged);
    }
  });

  // Initialize local state (solo + multiplayer)
  React.useEffect(() => {
    if (!game) return;
    baseGameRef.current = { ...baseGameRef.current, ...game };
    const nextState = {
      name: game.name,
      pin: game.pin,
      host_user: game.host_user,
      date: game.date,
      game_type: game.game_type,
      putt_type: game.putt_type,
      player_putts: game.player_putts || {},
      total_points: game.total_points || {},
      player_distances: game.player_distances || {},
      player_current_streaks: game.player_current_streaks || {},
      player_highest_streaks: game.player_highest_streaks || {},
      status: game.status
    };

    const isNewGame = lastLoadedGameIdRef.current !== game.id;
    lastLoadedGameIdRef.current = game.id;

    if (isSoloGame) {
      if (localGameStateRef.current) {
        if (hydratedFromStorageRef.current) {
          const merged = mergeIncomingGame(game);
          setLocalGameState(merged);
          localGameStateRef.current = merged;
        }
        return;
      }
      if (isNewGame) {
        setLocalGameState(nextState);
        localGameStateRef.current = nextState;
      }
      return;
    }

    if (pendingUpdateRef.current || pendingLiveRef.current || syncInFlightRef.current) return;
    if (!localGameStateRef.current || isNewGame) {
      setLocalGameState(nextState);
      localGameStateRef.current = nextState;
    }
  }, [game, isSoloGame]);

  const updateGameMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const startedAt = performance.now();
      const latestGame = queryClient.getQueryData(['game', id]) || game;
      const payload = mergeWithLatest(latestGame, data);
      const updated = await base44.entities.Game.update(id, payload, {
        returnSnapshot: false,
        mergeWith: latestGame
      });
      logSyncMetric('player_sync', performance.now() - startedAt, {
        game_id: id,
        game_type: game?.game_type || 'unknown'
      });
      return updated;
    },
    onSuccess: (updatedGame) => {
      const merged = mergeIncomingGame(updatedGame);
      setLocalGameState(merged);
      localGameStateRef.current = merged;
      queryClient.setQueryData(['game', gameId], merged);
    }
  });

  const flushPending = React.useCallback(async (idOverride, payloadOverride) => {
    if (isSoloGame) return;
    const id = idOverride || game?.id;
    const payload = payloadOverride || pendingUpdateRef.current;
    if (!id || !payload) return;

    if (syncInFlightRef.current) {
      queuedSyncRef.current = payload;
      return;
    }

    syncInFlightRef.current = true;
    pendingUpdateRef.current = null;
    try {
      await updateGameMutation.mutateAsync({ id, data: payload });
      lastSyncAtRef.current = Date.now();
      turnsSinceSyncRef.current = 0;
    } catch (error) {
      pendingUpdateRef.current = payload;
    } finally {
      syncInFlightRef.current = false;
      if (queuedSyncRef.current) {
        const queued = queuedSyncRef.current;
        queuedSyncRef.current = null;
        flushPendingRef.current?.(id, queued);
      } else if (queuedLiveRef.current) {
        const queued = queuedLiveRef.current;
        queuedLiveRef.current = null;
        flushLivePendingRef.current?.(id, queued);
      }
    }
  }, [game?.id, isSoloGame, updateGameMutation]);

  const flushLivePending = React.useCallback(async (idOverride, payloadOverride) => {
    if (isSoloGame) return;
    const id = idOverride || game?.id;
    const payload = payloadOverride || pendingLiveRef.current;
    if (!id || !payload) return;

    if (syncInFlightRef.current) {
      queuedLiveRef.current = payload;
      return;
    }

    syncInFlightRef.current = true;
    pendingLiveRef.current = null;
    try {
      const mergedPayload = buildLivePayload(payload, id);
      await base44.entities.Game.update(id, mergedPayload, { returnSnapshot: false });
    } catch (error) {
      pendingLiveRef.current = payload;
    } finally {
      syncInFlightRef.current = false;
      if (queuedSyncRef.current) {
        const queued = queuedSyncRef.current;
        queuedSyncRef.current = null;
        flushPendingRef.current?.(id, queued);
      } else if (queuedLiveRef.current) {
        const queued = queuedLiveRef.current;
        queuedLiveRef.current = null;
        flushLivePendingRef.current?.(id, queued);
      }
    }
  }, [buildLivePayload, game?.id, isSoloGame]);

  React.useEffect(() => {
    flushPendingRef.current = flushPending;
  }, [flushPending]);

  React.useEffect(() => {
    flushLivePendingRef.current = flushLivePending;
  }, [flushLivePending]);

  const scheduleFlush = React.useCallback((force = false) => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    const now = Date.now();
    const shouldSyncNow =
      force ||
      now - lastSyncAtRef.current > MULTIPLAYER_SYNC_INTERVAL_MS ||
      turnsSinceSyncRef.current >= 5;

    if (!shouldSyncNow) return;

    syncTimeoutRef.current = setTimeout(() => {
      syncTimeoutRef.current = null;
      flushPending();
    }, MULTIPLAYER_SYNC_DEBOUNCE_MS);
  }, [flushPending, MULTIPLAYER_SYNC_DEBOUNCE_MS, MULTIPLAYER_SYNC_INTERVAL_MS]);

  const scheduleLiveFlush = React.useCallback(() => {
    if (liveTimeoutRef.current) {
      clearTimeout(liveTimeoutRef.current);
    }
    liveTimeoutRef.current = setTimeout(() => {
      liveTimeoutRef.current = null;
      flushLivePending();
    }, LIVE_SYNC_DEBOUNCE_MS);
  }, [flushLivePending, LIVE_SYNC_DEBOUNCE_MS]);

  // Helper to update game state (local for solo, DB for multiplayer)
  const updateGameState = (data, options = {}) => {
    const { forceSync = false } = options;
    const current = getLatestState();
    if (isSoloGame) {
      // For solo games, update local state only
      const baseGame = queryClient.getQueryData(['game', gameId]) || game || current;
      const nextState = { ...baseGame, ...current, ...data };
      const liveStats = buildLiveStats(nextState);
      nextState.live_stats = {
        ...(nextState.live_stats || {}),
        [playerName]: liveStats
      };
      setLocalGameState(nextState);
      localGameStateRef.current = nextState;
    } else {
      if (!game?.id) return;
      if (game?.status === 'closed' || game?.join_closed === true) {
        toast.error('Mäng on suletud');
        return;
      }
      // For multiplayer games, update local cache immediately and debounce DB writes
      const nextState = { ...current, ...data };
      const liveStats = buildLiveStats(nextState);
      nextState.live_stats = {
        ...(nextState.live_stats || {}),
        [playerName]: liveStats
      };
      setLocalGameState(nextState);
      localGameStateRef.current = nextState;
      queryClient.setQueryData(['game', gameId], nextState);

      const remotePatch = buildRemotePatch(data);
      pendingUpdateRef.current = {
        ...(pendingUpdateRef.current || {}),
        ...remotePatch
      };
      turnsSinceSyncRef.current += 1;
      scheduleFlush(forceSync);

      pendingLiveRef.current = {
        ...(pendingLiveRef.current || {}),
        live_stats: { [playerName]: liveStats },
        total_points: { [playerName]: liveStats.total_points }
      };
      scheduleLiveFlush();
    }
  };

  const handleExit = React.useCallback(() => {
    if (pendingUpdateRef.current && gameIdRef.current) {
      flushPending(gameIdRef.current);
    }
    if (pendingLiveRef.current && gameIdRef.current) {
      flushLivePending(gameIdRef.current);
    }
    if (isSoloGame && soloStorageKey && localGameStateRef.current) {
      try {
        localStorage.setItem(soloStorageKey, JSON.stringify(localGameStateRef.current));
      } catch {
        // ignore storage errors
      }
    }
    onExit?.();
  }, [flushLivePending, flushPending, isSoloGame, onExit, soloStorageKey]);

  React.useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      if (liveTimeoutRef.current) {
        clearTimeout(liveTimeoutRef.current);
      }
      if (pendingUpdateRef.current && gameIdRef.current) {
        flushPending(gameIdRef.current);
      }
      if (pendingLiveRef.current && gameIdRef.current) {
        flushLivePending(gameIdRef.current);
      }
    };
  }, [flushLivePending, flushPending]);

  React.useEffect(() => {
    if (isSoloGame || !game?.id) return undefined;
    const interval = setInterval(() => {
      if (pendingUpdateRef.current) {
        flushPending();
      }
    }, MULTIPLAYER_SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [flushPending, game?.id, isSoloGame, MULTIPLAYER_SYNC_INTERVAL_MS]);

  // Save solo game to DB when completed
  const saveSoloGameMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const startedAt = performance.now();
      const updated = await base44.entities.Game.update(id, data);
      logSyncMetric('player_sync_solo', performance.now() - startedAt, {
        game_id: id,
        game_type: game?.game_type || 'unknown'
      });
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['game', gameId]);
      if (isSoloGame && soloStorageKey) {
        localStorage.removeItem(soloStorageKey);
      }
    }
  });

  const submitToLeaderboardMutation = useMutation({
    mutationFn: async () => {
      const playerPutts = game.player_putts?.[playerName] || [];
      const madePutts = playerPutts.filter(p => p.result === 'made').length;
      const totalPutts = playerPutts.length;
      const accuracy = totalPutts > 0 ? (madePutts / totalPutts) * 100 : 0;
      const resolvedPlayer = await resolveLeaderboardPlayer({
        game,
        playerName,
        cache: {}
      });
      const identityFilter = buildLeaderboardIdentityFilter(resolvedPlayer);

      const leaderboardData = {
        game_id: game.id,
        ...(resolvedPlayer.playerUid ? { player_uid: resolvedPlayer.playerUid } : {}),
        player_email: getLeaderboardEmail(resolvedPlayer),
        player_name: resolvedPlayer.playerName,
        game_type: game.game_type,
        score: game.total_points[playerName] || 0,
        accuracy: Math.round(accuracy * 10) / 10,
        made_putts: madePutts,
        total_putts: totalPutts,
        leaderboard_type: 'general',
        ...(resolvedPlayer.playerGender ? { player_gender: resolvedPlayer.playerGender } : {}),
        date: new Date().toISOString()
      };

      // Add distance for streak challenge
      if (game.game_type === 'streak_challenge') {
        leaderboardData.streak_distance = game.player_distances?.[playerName] || 0;
      }

      const [existingEntry] = await base44.entities.LeaderboardEntry.filter({
        ...identityFilter,
        game_type: game.game_type,
        leaderboard_type: 'general'
      });

      if (existingEntry) {
        if (leaderboardData.score > existingEntry.score) {
          await base44.entities.LeaderboardEntry.update(existingEntry.id, leaderboardData);
        }
        return existingEntry;
      }

      return await base44.entities.LeaderboardEntry.create(leaderboardData);
    },
    onSuccess: () => {
      setHasSubmitted(true);
      toast.success('Tulemus edetabelisse saadetud!');
    }
  });

  // Handle Classic/Short/Long/Random format submission (5 putts at once)
  const handleClassicSubmit = (madeCount) => {
    const gameType = game.game_type || 'classic';
    const format = GAME_FORMATS[gameType];
    const currentState = getLatestState();
    const playerDist = currentState.player_distances || {};
    const currentDistance = playerDist[playerName] || format.startDistance;
    
    // Create 5 putt records
    const newPutts = [];
    for (let i = 0; i < 5; i++) {
    const result = i < madeCount ? 'made' : 'missed';
    newPutts.push({
      distance: currentDistance,
      result,
      points: 0, // Individual putts don't score in classic formats
      timestamp: new Date().toISOString(),
      putt_type: game.putt_type || 'regular'
    });
    }

    const allPlayerPutts = { ...currentState.player_putts };
    if (!allPlayerPutts[playerName]) {
      allPlayerPutts[playerName] = [];
    }
    allPlayerPutts[playerName].push(...newPutts);

    // Calculate round score
    const roundScore = calculateRoundScore(currentDistance, madeCount);
    
    const newTotalPoints = { ...(currentState.total_points || {}) };
    newTotalPoints[playerName] = (newTotalPoints[playerName] || 0) + roundScore;

    // Calculate next distance
    let nextDistance;
    if (gameType === 'random_distance') {
      // Get truly random distance for next round
      const min = format.minDistance;
      const max = format.maxDistance;
      nextDistance = Math.floor(Math.random() * (max - min + 1)) + min;
    } else {
      nextDistance = getNextDistanceFromMade(gameType, madeCount);
    }

    const newPlayerDistances = { ...currentState.player_distances };
    newPlayerDistances[playerName] = nextDistance;

    // Check if game is complete after this update
    const updatedPuttsLength = allPlayerPutts[playerName].length;
    const willBeComplete = isGameComplete(gameType, updatedPuttsLength);

    const updateData = {
      player_putts: allPlayerPutts,
      total_points: newTotalPoints,
      player_distances: newPlayerDistances,
      ...(willBeComplete && isSoloGame ? { status: 'completed' } : {})
    };

    // For solo games that are complete, save to DB
    if (isSoloGame && willBeComplete) {
      saveSoloGameMutation.mutate({
        id: game.id,
        data: updateData
      });
    } else {
      updateGameState(updateData, { forceSync: willBeComplete });
    }
  };

  // Handle Back & Forth / Streak / Random format (1 putt at a time)
  const handleBackAndForthPutt = (wasMade) => {
    const gameType = game.game_type || 'classic';
    const format = GAME_FORMATS[gameType];
    const currentState = getLatestState();
    const playerDist = currentState.player_distances || {};
    const currentDistance = playerDist[playerName] || format.startDistance;
    const result = wasMade ? 'made' : 'missed';
    const points = wasMade ? currentDistance : 0;

    const newPutt = {
      distance: currentDistance,
      result,
      points,
      timestamp: new Date().toISOString(),
      putt_type: game.putt_type || 'regular'
    };

    const allPlayerPutts = { ...currentState.player_putts };
    if (!allPlayerPutts[playerName]) {
      allPlayerPutts[playerName] = [];
    }
    allPlayerPutts[playerName].push(newPutt);

    const newTotalPoints = { ...(currentState.total_points || {}) };
    newTotalPoints[playerName] = (newTotalPoints[playerName] || 0) + points;

    // For Streak Challenge, handle streak tracking
    let nextDistance = currentDistance;
    let streakUpdate = {};

    if (gameType === 'streak_challenge') {
      const currentStreaks = currentState.player_current_streaks || {};
      const highestStreaks = currentState.player_highest_streaks || {};
      let playerCurrentStreak = currentStreaks[playerName] || 0;
      let playerHighestStreak = highestStreaks[playerName] || 0;

      if (wasMade) {
        playerCurrentStreak += 1;
        playerHighestStreak = Math.max(playerHighestStreak, playerCurrentStreak);
      } else {
        playerCurrentStreak = 0; // Reset on miss
      }

      streakUpdate = {
        player_current_streaks: { ...currentStreaks, [playerName]: playerCurrentStreak },
        player_highest_streaks: { ...highestStreaks, [playerName]: playerHighestStreak }
      };

      // Use highest streak as the points for leaderboard
      newTotalPoints[playerName] = playerHighestStreak;
    } else if (gameType === 'back_and_forth') {
      nextDistance = getNextDistanceBackAndForth(currentDistance, wasMade);
    }

    const newPlayerDistances = { ...currentState.player_distances };
    newPlayerDistances[playerName] = nextDistance;

    // Check if game is complete after this update (for back_and_forth)
    const updatedPuttsLength = allPlayerPutts[playerName].length;
    const willBeComplete = gameType !== 'streak_challenge' && isGameComplete(gameType, updatedPuttsLength);

    const updateData = {
      player_putts: allPlayerPutts,
      total_points: newTotalPoints,
      player_distances: newPlayerDistances,
      ...streakUpdate,
      ...(willBeComplete && isSoloGame ? { status: 'completed' } : {})
    };

    // For solo games that are complete, save to DB
    if (isSoloGame && willBeComplete) {
      saveSoloGameMutation.mutate({
        id: game.id,
        data: updateData
      });
    } else {
      updateGameState(updateData, { forceSync: willBeComplete });
    }
  };

  // Handle Streak Challenge distance selection
  const handleStreakDistanceSelect = (distance) => {
    const currentState = getLatestState();
    const newPlayerDistances = { ...currentState.player_distances };
    newPlayerDistances[playerName] = distance;

    updateGameState({
      player_distances: newPlayerDistances
    });
    setStreakDistanceSelected(true);
  };

  // Handle Finish Training for Streak Challenge
  const handleFinishTraining = () => {
    const updateData = { status: 'completed' };
    updateGameState(updateData, { forceSync: true });

    if (isSoloGame) {
      const nextState = localGameStateRef.current || { ...getLatestState(), ...updateData };
      saveSoloGameMutation.mutate({
        id: game.id,
        data: nextState
      });
    } else {
      setStreakComplete(true);
    }
  };

  const handleUndo = () => {
    const currentState = getLatestState();
    const playerPutts = currentState.player_putts?.[playerName];
    if (!playerPutts || playerPutts.length === 0) return;

    const gameType = game.game_type || 'classic';
    const format = GAME_FORMATS[gameType];
    const newPutts = [...playerPutts];

    if (format.singlePuttMode) {
      // Back & Forth: remove 1 putt
      const lastPutt = newPutts.pop();

      const allPlayerPutts = { ...currentState.player_putts };
      allPlayerPutts[playerName] = newPutts;

      const newTotalPoints = { ...(currentState.total_points || {}) };
      newTotalPoints[playerName] = (newTotalPoints[playerName] || 0) - lastPutt.points;

      // Recalculate distance - if there was a previous putt, check if it was made/missed
      let prevDistance = format.startDistance;
      if (newPutts.length > 0) {
        const prevPutt = newPutts[newPutts.length - 1];
        prevDistance = getNextDistanceBackAndForth(prevPutt.distance, prevPutt.result === 'made');
      }

      const newPlayerDistances = { ...currentState.player_distances };
      newPlayerDistances[playerName] = prevDistance;

      updateGameState({
        player_putts: allPlayerPutts,
        total_points: newTotalPoints,
        player_distances: newPlayerDistances
      });
    } else {
      // Classic/Short/Long: remove last 5 putts (1 round)
      const lastRoundPutts = newPutts.splice(-5);
      const madeCount = lastRoundPutts.filter(p => p.result === 'made').length;
      const roundDistance = lastRoundPutts[0].distance;
      const roundScore = calculateRoundScore(roundDistance, madeCount);

      const allPlayerPutts = { ...currentState.player_putts };
      allPlayerPutts[playerName] = newPutts;

      const newTotalPoints = { ...(currentState.total_points || {}) };
      newTotalPoints[playerName] = (newTotalPoints[playerName] || 0) - roundScore;

      // Recalculate distance from previous round
      let prevDistance = format.startDistance;
      if (newPutts.length >= 5) {
        const prevRoundPutts = newPutts.slice(-5);
        const prevMade = prevRoundPutts.filter(p => p.result === 'made').length;
        // For random_distance mode, restore the actual previous distance instead of generating new
        if (gameType === 'random_distance') {
          prevDistance = prevRoundPutts[0].distance;
        } else {
          prevDistance = getNextDistanceFromMade(gameType, prevMade);
        }
      }

      const newPlayerDistances = { ...currentState.player_distances };
      newPlayerDistances[playerName] = prevDistance;

      updateGameState({
        player_putts: allPlayerPutts,
        total_points: newTotalPoints,
        player_distances: newPlayerDistances
      });
    }
  };

  // Use local state for solo games, otherwise use game data
  const currentState = localGameState || game || {};
  const gameType = currentState?.game_type || 'classic';
  const format = GAME_FORMATS[gameType] || GAME_FORMATS.classic;
  const playerPutts = currentState?.player_putts?.[playerName] || [];
  const playerDistances = currentState?.player_distances || {};
  const currentDistance = playerDistances[playerName] || format.startDistance;
  const canUndo = playerPutts.length > 0;
  const currentStreaks = currentState?.player_current_streaks || {};
  const currentStreak = currentStreaks[playerName] || 0;
  const currentScore = gameType === 'streak_challenge'
    ? (currentState?.player_highest_streaks?.[playerName] || 0)
    : (currentState?.total_points?.[playerName] || 0);
  const isComplete = Boolean(currentState) && (
    isGameComplete(gameType, playerPutts.length) ||
    (gameType === 'streak_challenge' && (currentState.status === 'completed' || streakComplete))
  );
  const userRole = user?.app_role || 'user';
  const canAdminSubmit = ['trainer', 'admin', 'super_admin'].includes(userRole);
  const isHost = Boolean(user?.email && currentState?.host_user && user.email === currentState.host_user);
  const canSubmitHosted = isHost || canAdminSubmit;

  // Solo game completion uses the in-page end screen (no popup prompts).

  if (isLoading || !game) {
    return <LoadingState />;
  }

  // Completed View
  if (isComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
        <div className="max-w-lg mx-auto p-4 pt-16">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center mb-8"
          >
            <div className="w-32 h-32 bg-gradient-to-br from-amber-400 to-amber-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-amber-300">
              <Trophy className="w-16 h-16 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-slate-800 mb-4">🎉 Lõpetatud!</h1>
            <p className="text-xl text-slate-600 mb-2">Lõpetasid kõik ringid</p>
            <p className="text-4xl font-bold text-emerald-600">{currentScore} punkti</p>
            </motion.div>

            {/* Performance Analysis */}
            <PerformanceAnalysis playerPutts={playerPutts} />

            <div className="space-y-3 mt-6">
            {!hasSubmitted && (isSoloGame || canSubmitHosted) && (
              <Button
                onClick={() => submitToLeaderboardMutation.mutate()}
                disabled={submitToLeaderboardMutation.isPending}
                className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 rounded-xl"
              >
                <Upload className="w-5 h-5 mr-2" />
                Saada edetabelisse
              </Button>
            )}
            <Button
              onClick={() => setShowLeaderboard(true)}
              className="w-full h-14 bg-slate-600 hover:bg-slate-700 rounded-xl"
            >
              <Trophy className="w-5 h-5 mr-2" />
              Vaata edetabelit
            </Button>
            <Button
              onClick={handleExit}
              variant="outline"
              className="w-full h-14 rounded-xl"
            >
              Välju mängust
            </Button>
          </div>
        </div>

        {/* Mobile Leaderboard */}
        {showLeaderboard && (
          <MobileLeaderboard game={game} onClose={() => setShowLeaderboard(false)} />
        )}
      </div>
    );
  }

  // Scoring View
  const currentRound = gameType === 'streak_challenge' ? 1 : Math.floor(playerPutts.length / format.puttsPerRound) + 1;
  const totalRounds = gameType === 'streak_challenge' ? 1 : getTotalRounds(gameType);

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <div className="max-w-lg mx-auto p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pt-4">
          <div className="flex items-center gap-2">
            <BackButton onClick={handleExit} showLabel={false} className="px-2" />
            <HomeButton showLabel={false} className="px-2" />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-bold text-slate-800">{currentState.name || game.name}</h2>
            <p className="text-sm text-slate-500">
              {format.name} • Ring {currentRound}/{totalRounds}
            </p>
          </div>
          <button
            onClick={() => setShowLeaderboard(true)}
            className="text-emerald-600 hover:text-emerald-700"
          >
            <Trophy className="w-5 h-5" />
          </button>
        </div>

        {/* Your Stats */}
        {gameType !== 'streak_challenge' && (
          <div className="bg-white rounded-xl p-2 sm:p-3 shadow-sm border border-slate-100 mb-3 sm:mb-4">
            <div className="flex items-center justify-around text-center">
              <div>
                <div className="text-[11px] sm:text-xs text-slate-500">{gameType === 'streak_challenge' ? 'Parim seeria' : 'Punktid'}</div>
                <div className="text-xl sm:text-2xl font-bold text-emerald-600">
                  {hideScore ? '***' : currentScore}
                </div>
              </div>
              <div className="h-8 sm:h-10 w-px bg-slate-200" />
              <div>
                <div className="text-[11px] sm:text-xs text-slate-500">{gameType === 'streak_challenge' ? 'Putid' : 'Ring'}</div>
                <div className="text-xl sm:text-2xl font-bold text-slate-600">
                  {gameType === 'streak_challenge' ? playerPutts.length : `${currentRound}/${totalRounds}`}
                </div>
              </div>
              <div className="h-8 sm:h-10 w-px bg-slate-200" />
              <button
                onClick={() => setHideScore(!hideScore)}
                className="flex flex-col items-center justify-center"
              >
                {hideScore ? (
                  <EyeOff className="w-5 h-5 text-slate-400" />
                ) : (
                  <Eye className="w-5 h-5 text-slate-400" />
                )}
                <div className="text-[11px] sm:text-xs text-slate-400 mt-1">
                  {hideScore ? 'Näita' : 'Peida'}
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Score Input */}
         {gameType === 'streak_challenge' ? (
           <StreakChallengeInput
               player={playerName}
               currentDistance={currentDistance}
               onMade={() => handleBackAndForthPutt(true)}
               onMissed={() => handleBackAndForthPutt(false)}
               canUndo={canUndo}
               onUndo={handleUndo}
               currentStreak={currentStreak}
               showDistanceSelector={!streakDistanceSelected && playerPutts.length === 0}
               onDistanceSelect={handleStreakDistanceSelect}
               onFinishTraining={handleFinishTraining}
             />
         ) : format.singlePuttMode ? (
           gameType === 'back_and_forth' ? (
             <BackAndForthScoreInput
               player={playerName}
               currentDistance={currentDistance}
               onMade={() => handleBackAndForthPutt(true)}
               onMissed={() => handleBackAndForthPutt(false)}
               canUndo={canUndo}
               onUndo={handleUndo}
               putts={playerPutts}
               puttType={game.putt_type || 'regular'}
               totalPoints={currentScore}
               hideScore={hideScore}
             />
           ) : (
             <BackAndForthInput
               player={playerName}
               currentDistance={currentDistance}
               onMade={() => handleBackAndForthPutt(true)}
               onMissed={() => handleBackAndForthPutt(false)}
               canUndo={canUndo}
               onUndo={handleUndo}
             />
           )
         ) : (
          <ClassicScoreInput
            player={playerName}
            currentDistance={currentDistance}
            onSubmit={handleClassicSubmit}
            canUndo={canUndo}
            onUndo={handleUndo}
            distanceMap={format.distanceMap || {}}
            currentRoundPutts={playerPutts}
            puttType={game.putt_type || 'regular'}
            totalFrames={getTotalRounds(gameType)}
          />
         )}
      </div>

      {/* Mobile Leaderboard */}
      {showLeaderboard && (
        <MobileLeaderboard game={game} onClose={() => setShowLeaderboard(false)} />
      )}
    </div>
  );
}
