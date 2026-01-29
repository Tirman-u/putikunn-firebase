import React, { useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';
import useRealtimeGame from '@/hooks/use-realtime-game';
import { getATWMovement, isATWRoundComplete, shouldATWRestart } from '@/components/putting/gameRules';
import { logSyncMetric } from '@/lib/metrics';

export default function useATWGameState({ gameId, playerName, isSolo }) {
  const queryClient = useQueryClient();
  const ATW_SYNC_DELAY_MS_SOLO = 1500;
  const ATW_SYNC_DELAY_MS_MULTI = 250;
  const pendingUpdateRef = React.useRef([]);
  const updateTimeoutRef = React.useRef(null);
  const localSeqRef = React.useRef(0);
  const lastActionRef = React.useRef({ type: null, at: 0 });
  const lastSyncRef = React.useRef(0);
  const turnsSinceSyncRef = React.useRef(0);
  const UNDO_SOFT_LOCK_MS = 200;

  const bumpLocalSeq = useCallback(() => {
    localSeqRef.current += 1;
    return localSeqRef.current;
  }, []);

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: game, isLoading } = useQuery({
    queryKey: ['game', gameId],
    queryFn: async () => {
      const games = await base44.entities.Game.filter({ id: gameId });
      return games[0];
    },
    refetchInterval: false
  });

  const getLatestGame = useCallback(() => {
    return queryClient.getQueryData(['game', gameId]) || game;
  }, [game, gameId, queryClient]);

  const handleRealtimeEvent = useCallback((event) => {
    let nextData = event.data;
    const localGame = queryClient.getQueryData(['game', gameId]);
    const localPlayerState = localGame?.atw_state?.[playerName];
    const localSeq = localPlayerState?.client_seq ?? localSeqRef.current ?? 0;
    const incomingSeq = nextData?.atw_state?.[playerName]?.client_seq ?? 0;

    if (localPlayerState && incomingSeq < localSeq) {
      nextData = {
        ...nextData,
        atw_state: {
          ...(nextData.atw_state || {}),
          [playerName]: localPlayerState
        },
        total_points: {
          ...(nextData.total_points || {}),
          [playerName]: localGame?.total_points?.[playerName] ?? nextData?.total_points?.[playerName] ?? 0
        }
      };
    }

    queryClient.setQueryData(['game', gameId], nextData);
  }, [gameId, playerName, queryClient]);

  useRealtimeGame({
    gameId,
    enabled: !!gameId && !isSolo,
    throttleMs: 1000,
    eventTypes: ['update', 'delete'],
    onEvent: handleRealtimeEvent
  });

  const defaultPlayerState = useMemo(() => ({
    current_distance_index: 0,
    direction: 'UP',
    laps_completed: 0,
    turns_played: 0,
    total_makes: 0,
    total_putts: 0,
    current_distance_points: 0,
    current_round_draft: { attempts: [], is_finalized: false },
    history: [],
    best_score: 0,
    best_laps: 0,
    best_accuracy: 0,
    attempts_count: 0
  }), []);

  const mergePlayerUpdate = useCallback((latestGame, updatedState, updatedPoints) => {
    return {
      atw_state: {
        ...(latestGame.atw_state || {}),
        [playerName]: updatedState
      },
      total_points: {
        ...(latestGame.total_points || {}),
        [playerName]: updatedPoints
      }
    };
  }, [playerName]);

  const updateGameWithLatest = useCallback(async ({ updatedState, updatedPoints, status }) => {
    const games = await base44.entities.Game.filter({ id: gameId });
    const latestGame = games?.[0];
    if (!latestGame) return;

    const latestSeq = latestGame.atw_state?.[playerName]?.client_seq;
    const incomingSeq = updatedState?.client_seq;
    if (typeof latestSeq === 'number' && typeof incomingSeq === 'number' && incomingSeq < latestSeq) {
      return;
    }

    const payload = mergePlayerUpdate(latestGame, updatedState, updatedPoints);
    const updatePayload = status ? { ...payload, status } : payload;
    const startedAt = performance.now();
    await base44.entities.Game.update(gameId, updatePayload);
    logSyncMetric('atw_sync', performance.now() - startedAt, {
      game_id: gameId,
      player: playerName,
      status: status || latestGame.status || 'active'
    });
  }, [gameId, mergePlayerUpdate, playerName]);

  const submitTurnMutation = useMutation({
    mutationFn: async ({ updatedState, updatedPoints }) => {
      await updateGameWithLatest({ updatedState, updatedPoints });
    },
    onError: () => {
      toast.error('Viga tulemuse salvestamisel');
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
    }
  });

  const handleRetry = useCallback(async (options = {}) => {
    const { silent = false } = options;
    lastActionRef.current = { type: 'retry', at: Date.now() };
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    pendingUpdateRef.current = [];
    

    const latestGame = getLatestGame();
    const playerState = { ...defaultPlayerState, ...(latestGame.atw_state?.[playerName] || {}) };
    const currentScore = latestGame.total_points?.[playerName] || 0;
    const bestScore = latestGame.atw_state[playerName]?.best_score || 0;

    const currentAccuracy = playerState.total_putts > 0
      ? ((playerState.total_makes / playerState.total_putts) * 100)
      : 0;
    const bestAccuracy = playerState.best_accuracy || 0;

    const resetState = {
      current_distance_index: 0,
      direction: 'UP',
      laps_completed: 0,
      turns_played: 0,
      total_makes: 0,
      total_putts: 0,
      current_distance_points: 0,
      current_round_draft: { attempts: [], is_finalized: false },
      history: [],
      best_score: Math.max(bestScore, currentScore),
      best_laps: Math.max(playerState.best_laps || 0, playerState.laps_completed || 0),
      best_accuracy: Math.max(bestAccuracy, currentAccuracy),
      attempts_count: (playerState.attempts_count || 0) + 1,
      client_seq: bumpLocalSeq()
    };

    const nextAtwState = {
      ...latestGame.atw_state,
      [playerName]: resetState
    };

    const nextTotalPoints = {
      ...latestGame.total_points,
      [playerName]: 0
    };

    queryClient.setQueryData(['game', gameId], prev => {
      if (!prev) return prev;
      return {
        ...prev,
        atw_state: nextAtwState,
        total_points: nextTotalPoints
      };
    });

    await updateGameWithLatest({
      updatedState: resetState,
      updatedPoints: 0
    });
    queryClient.invalidateQueries({ queryKey: ['game', gameId] });
    if (!silent) {
      toast.success('Alustad uuesti 5m pealt!');
    }
  }, [bumpLocalSeq, defaultPlayerState, gameId, getLatestGame, playerName, queryClient, updateGameWithLatest]);

  const handleSubmitPutts = useCallback((madePutts) => {
    lastActionRef.current = { type: madePutts === 0 ? 'missed' : 'made', at: Date.now() };
    const latestGame = getLatestGame();
    const config = latestGame.atw_config;
    const playerState = { ...defaultPlayerState, ...(latestGame.atw_state?.[playerName] || {}) };

    const currentIndex = playerState.current_distance_index;
    const direction = playerState.direction;
    const threshold = config.advance_threshold;
    const distances = config.distances;
    const discsPerTurn = config.discs_per_turn || 1;
    const actualMakes = Math.max(0, Math.min(Number(madePutts) || 0, discsPerTurn));
    const misses = discsPerTurn - actualMakes;
    const shouldRestart = shouldATWRestart(discsPerTurn, actualMakes);

    if (shouldRestart) {
      handleRetry({ silent: true });
      return;
    }

    const { newIndex, newDirection, lapEvent } = getATWMovement({
      currentIndex,
      direction,
      distances,
      threshold,
      discsPerTurn,
      madeCount: actualMakes
    });

    const currentDistance = distances[currentIndex];
    const previousDistancePoints = playerState.current_distance_points || 0;
    const attemptPoints = actualMakes > 0 ? currentDistance * actualMakes : 0;
    const distancePointsTotal = Math.max(previousDistancePoints, attemptPoints);
    const pointsAwarded = Math.max(0, distancePointsTotal - previousDistancePoints);
    const movedToNewDistance = newIndex !== currentIndex;
    const newDistancePoints = movedToNewDistance ? 0 : distancePointsTotal;
    const isRoundComplete = isATWRoundComplete({ lapEvent, newIndex, newDirection });

    const updatedState = {
      current_distance_index: newIndex,
      direction: newDirection,
      laps_completed: playerState.laps_completed + (lapEvent ? 1 : 0),
      turns_played: playerState.turns_played + 1,
      total_makes: playerState.total_makes + actualMakes,
      total_putts: playerState.total_putts + discsPerTurn,
      current_distance_points: newDistancePoints,
      current_round_draft: { attempts: [], is_finalized: false },
      history: [...playerState.history, {
        turn_number: playerState.turns_played + 1,
        distance: currentDistance,
        direction: direction,
        made_putts: actualMakes,
        moved_to_distance: distances[newIndex],
        points_awarded: pointsAwarded,
        distance_points_total: distancePointsTotal,
        lap_event: lapEvent,
        failed_to_advance: actualMakes > 0 && (discsPerTurn >= 3 ? misses >= 1 : actualMakes < threshold),
        missed_all: actualMakes === 0
      }],
      best_score: playerState.best_score,
      client_seq: bumpLocalSeq()
    };

    queryClient.setQueryData(['game', gameId], {
      ...latestGame,
      atw_state: {
        ...latestGame.atw_state,
        [playerName]: updatedState
      },
      total_points: {
        ...latestGame.total_points,
        [playerName]: (latestGame.total_points?.[playerName] || 0) + pointsAwarded
      }
    });

    const pending = { madePutts: actualMakes };
    pendingUpdateRef.current = [pending];

    const now = Date.now();
    turnsSinceSyncRef.current += 1;
    const shouldSyncNow =
      isRoundComplete ||
      now - lastSyncRef.current > 10000 ||
      turnsSinceSyncRef.current >= 5;
    if (!shouldSyncNow) return;

    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    const delay = isSolo ? ATW_SYNC_DELAY_MS_SOLO : ATW_SYNC_DELAY_MS_MULTI;
    updateTimeoutRef.current = setTimeout(() => {
      if (pendingUpdateRef.current.length) {
        const latestGame = queryClient.getQueryData(['game', gameId]);
        const latestState = latestGame?.atw_state?.[playerName];
        const latestPoints = latestGame?.total_points?.[playerName] || 0;
        if (latestState) {
          submitTurnMutation.mutate({
            updatedState: latestState,
            updatedPoints: latestPoints
          });
        }
      }
      pendingUpdateRef.current = [];
    }, delay);

    lastSyncRef.current = now;
    turnsSinceSyncRef.current = 0;
  }, [bumpLocalSeq, defaultPlayerState, gameId, getLatestGame, handleRetry, isSolo, playerName, queryClient, submitTurnMutation]);

  const completeGameMutation = useMutation({
    mutationFn: async () => {
      const playerState = { ...defaultPlayerState, ...(game.atw_state?.[playerName] || {}) };
      const currentScore = game.total_points?.[playerName] || 0;
      const bestScore = Math.max(playerState.best_score || 0, currentScore);

      await base44.entities.Game.update(gameId, {
        status: 'completed',
        atw_state: {
          ...game.atw_state,
          [playerName]: {
            ...playerState,
            best_score: bestScore
          }
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
    }
  });

  const submitToLeaderboardMutation = useMutation({
    mutationFn: async () => {
      const playerState = { ...defaultPlayerState, ...(game.atw_state?.[playerName] || {}) };
      const madePutts = playerState.total_makes;
      const totalPutts = playerState.total_putts;
      const accuracy = totalPutts > 0 ? (madePutts / totalPutts) * 100 : 0;

      return await base44.entities.LeaderboardEntry.create({
        game_id: game.id,
        player_uid: user?.id,
        player_email: user?.email || 'unknown',
        player_name: playerName,
        game_type: 'around_the_world',
        score: game?.total_points?.[playerName] || 0,
        accuracy: Math.round(accuracy * 10) / 10,
        made_putts: madePutts,
        total_putts: totalPutts,
        leaderboard_type: 'general',
        player_gender: user?.gender || 'M',
        date: new Date().toISOString()
      });
    },
    onSuccess: () => {
      toast.success('Result submitted to leaderboard!');
    }
  });

  const handleCompleteGame = useCallback(() => {
    completeGameMutation.mutate();
  }, [completeGameMutation]);

  const handlePlayAgain = useCallback(async () => {
    lastActionRef.current = { type: 'play_again', at: Date.now() };
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    pendingUpdateRef.current = [];
    

    const latestGame = getLatestGame();
    const playerState = { ...defaultPlayerState, ...(latestGame.atw_state?.[playerName] || {}) };
    const currentScore = latestGame.total_points?.[playerName] || 0;
    const bestScore = Math.max(playerState.best_score || 0, currentScore);

    const resetState = {
      current_distance_index: 0,
      direction: 'UP',
      laps_completed: 0,
      turns_played: 0,
      total_makes: 0,
      total_putts: 0,
      current_distance_points: 0,
      current_round_draft: { attempts: [], is_finalized: false },
      history: [],
      best_score: bestScore,
      attempts_count: (playerState.attempts_count || 0) + 1,
      client_seq: bumpLocalSeq()
    };

    const nextAtwState = {
      ...latestGame.atw_state,
      [playerName]: resetState
    };

    const nextTotalPoints = {
      ...latestGame.total_points,
      [playerName]: 0
    };

    queryClient.setQueryData(['game', gameId], prev => {
      if (!prev) return prev;
      return {
        ...prev,
        status: 'active',
        atw_state: nextAtwState,
        total_points: nextTotalPoints
      };
    });

    await updateGameWithLatest({
      updatedState: resetState,
      updatedPoints: 0,
      status: 'active'
    });

    queryClient.invalidateQueries({ queryKey: ['game', gameId] });
  }, [bumpLocalSeq, defaultPlayerState, gameId, getLatestGame, playerName, queryClient, updateGameWithLatest]);

  const handleExit = useCallback(async () => {
    const latestPlayerState = game.atw_state?.[playerName] || {};
    const currentScore = game.total_points?.[playerName] || 0;
    const bestScore = latestPlayerState.best_score || 0;
    const currentAccuracy = latestPlayerState.total_putts > 0
      ? ((latestPlayerState.total_makes / latestPlayerState.total_putts) * 100)
      : 0;
    const bestAccuracy = latestPlayerState.best_accuracy || 0;

    await base44.entities.Game.update(gameId, {
      atw_state: {
        ...game.atw_state,
        [playerName]: {
          ...latestPlayerState,
          best_score: Math.max(bestScore, currentScore),
          best_laps: Math.max(latestPlayerState.best_laps || 0, latestPlayerState.laps_completed || 0),
          best_accuracy: Math.max(bestAccuracy, currentAccuracy)
        }
      }
    });

    if (isSolo) {
      handleCompleteGame();
    } else {
      window.location.href = createPageUrl('Home');
    }
  }, [game, gameId, handleCompleteGame, isSolo, playerName]);

  const config = game?.atw_config;

  const buildUndoPayload = useCallback((gameState) => {
    const playerState = { ...defaultPlayerState, ...(gameState.atw_state?.[playerName] || {}) };

    if (!playerState.history || playerState.history.length === 0) {
      throw new Error('Pole midagi tagasi võtta');
    }

    const lastTurn = playerState.history[playerState.history.length - 1];
    const newHistory = playerState.history.slice(0, -1);

    let previousIndex = 0;
    let previousDirection = 'UP';
    let previousLaps = 0;
    let previousDistancePoints = 0;

    if (newHistory.length > 0) {
      const prevTurn = newHistory[newHistory.length - 1];
      const distances = config.distances;
      const resolvedIndex = distances.indexOf(prevTurn.moved_to_distance);
      previousIndex = resolvedIndex >= 0 ? resolvedIndex : 0;
      previousDirection = prevTurn.lap_event
        ? (prevTurn.direction === 'UP' ? 'DOWN' : 'UP')
        : prevTurn.direction;
      previousLaps = playerState.laps_completed - (lastTurn.lap_event ? 1 : 0);
      previousDistancePoints = prevTurn.moved_to_distance === prevTurn.distance
        ? (prevTurn.distance_points_total || 0)
        : 0;
    }

    const updatedState = {
      ...playerState,
      current_distance_index: previousIndex,
      direction: previousDirection,
      laps_completed: previousLaps,
      turns_played: playerState.turns_played - 1,
      total_makes: playerState.total_makes - lastTurn.made_putts,
      total_putts: playerState.total_putts - config.discs_per_turn,
      history: newHistory,
      current_round_draft: { attempts: [], is_finalized: false },
      current_distance_points: previousDistancePoints
    };

    updatedState.client_seq = bumpLocalSeq();

    const updatedPoints = Math.max(0, (gameState.total_points?.[playerName] || 0) - lastTurn.points_awarded);

    return { updatedState, updatedPoints };
  }, [bumpLocalSeq, config, defaultPlayerState, playerName]);

  const undoMutation = useMutation({
    mutationFn: async ({ updatedState, updatedPoints }) => {
      await updateGameWithLatest({ updatedState, updatedPoints });
    },
    onSuccess: () => {
      toast.success('Viimane käik tühistatud');
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
      toast.error(error.message || 'Viga tagasivõtmisel');
    }
  });

  const handleUndo = useCallback(() => {
    const latestGame = getLatestGame();
    if (!config || !latestGame) return;

    const now = Date.now();
    if (now - lastActionRef.current.at < UNDO_SOFT_LOCK_MS) {
      return;
    }
    lastActionRef.current = { type: 'undo', at: now };

    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    pendingUpdateRef.current = [];

    let payload;
    try {
      payload = buildUndoPayload(latestGame);
    } catch (error) {
      toast.error(error.message || 'Viga tagasivõtmisel');
      return;
    }

    queryClient.setQueryData(['game', gameId], prev => {
      if (!prev) return prev;
      return {
        ...prev,
        atw_state: {
          ...(prev.atw_state || {}),
          [playerName]: payload.updatedState
        },
        total_points: {
          ...(prev.total_points || {}),
          [playerName]: payload.updatedPoints
        }
      };
    });

    undoMutation.mutate(payload);
  }, [buildUndoPayload, config, gameId, getLatestGame, playerName, queryClient, undoMutation]);

  React.useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      if (pendingUpdateRef.current.length) {
        const latestGame = queryClient.getQueryData(['game', gameId]);
        const latestState = latestGame?.atw_state?.[playerName];
        const latestPoints = latestGame?.total_points?.[playerName] || 0;
        if (latestState) {
          submitTurnMutation.mutate({
            updatedState: latestState,
            updatedPoints: latestPoints
          });
        }
        pendingUpdateRef.current = [];
      }
    };
  }, [gameId, playerName, queryClient, submitTurnMutation]);

  const playerState = useMemo(
    () => ({ ...defaultPlayerState, ...(game?.atw_state?.[playerName] || {}) }),
    [game?.atw_state, playerName, defaultPlayerState]
  );

  const gameStats = useMemo(() => {
    if (!config) return null;

    const currentDistance = config.distances?.[playerState.current_distance_index || 0];
    const totalScore = game?.total_points?.[playerName] || 0;
    const bestScore = playerState.best_score || 0;
    const makeRate = playerState.total_putts > 0
      ? ((playerState.total_makes / playerState.total_putts) * 100).toFixed(0)
      : 0;

    const difficultyLabels = {
      easy: 'Easy',
      medium: 'Medium',
      hard: 'Hard',
      ultra_hard: 'Ultra Hard',
      impossible: 'Impossible'
    };

    const difficultyLabel = difficultyLabels[config.difficulty] || 'Medium';

    return { currentDistance, totalScore, bestScore, makeRate, difficultyLabel };
  }, [config, playerState, game?.total_points, playerName]);

  return {
    game,
    isLoading,
    config,
    playerState,
    gameStats,
    handleSubmitPutts,
    handleUndo,
    undoMutation,
    handleCompleteGame,
    handlePlayAgain,
    handleExit,
    submitToLeaderboardMutation,
    user
  };
}
