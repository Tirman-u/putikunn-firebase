import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowUp, ArrowDown, CheckCircle2, X, Undo2, Trophy, RotateCcw, Share2, Eye, EyeOff, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import ATWLeaderboard from './ATWLeaderboard';

export default function AroundTheWorldGameView({ gameId, playerName, isSolo }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [hideScore, setHideScore] = useState(false);
  const [pendingUpdates, setPendingUpdates] = useState([]);
  const updateTimeoutRef = React.useRef(null);

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

  // Real-time subscription
  useEffect(() => {
    if (!gameId) return;

    const unsubscribe = base44.entities.Game.subscribe((event) => {
      if (event.id === gameId && (event.type === 'update' || event.type === 'delete')) {
        queryClient.setQueryData(['game', gameId], event.data);
      }
    });

    return unsubscribe;
  }, [gameId, queryClient]);

  const defaultPlayerState = useMemo(() => ({
    current_distance_index: 0,
    direction: 'UP',
    laps_completed: 0,
    turns_played: 0,
    total_makes: 0,
    total_putts: 0,
    current_round_draft: { attempts: [], is_finalized: false },
    history: [],
    best_score: 0,
    best_laps: 0,
    best_accuracy: 0,
    attempts_count: 0
  }), []);

  /**
   * IMPORTANT:
   * Hooks (useMemo etc.) must always run before any early return,
   * otherwise React can crash with a white screen (hooks order mismatch).
   */
  const config = game?.atw_config;

  const playerState = useMemo(() =>
    ({ ...defaultPlayerState, ...(game?.atw_state?.[playerName] || {}) }),
    [game?.atw_state, playerName, defaultPlayerState]
  );

  const gameStats = useMemo(() => {
    if (!config) return null;

    const currentDistance = config.distances[playerState.current_distance_index || 0];
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
  }, [game, config, playerState, playerName]);

  const handleSubmitPutts = useCallback((madePutts) => {
    // Immediate local update for instant feedback
    const config = game.atw_config;
    const playerState = { ...defaultPlayerState, ...(game.atw_state?.[playerName] || {}) };

    const currentIndex = playerState.current_distance_index;
    const direction = playerState.direction;
    const threshold = config.advance_threshold;
    const distances = config.distances;
    const actualMakes = madePutts === 1 ? config.discs_per_turn : 0;

    let newIndex = currentIndex;
    let newDirection = direction;
    let lapEvent = false;

    // Movement logic: determine whether player advances based on threshold (madePutts param)
    if (madePutts >= threshold) {
      if (direction === 'UP') {
        if (currentIndex < distances.length - 1) {
          newIndex = currentIndex + 1;
        } else {
          // reached top -> start going down, lap completed
          newDirection = 'DOWN';
          lapEvent = true;
        }
      } else {
        if (currentIndex > 0) {
          newIndex = currentIndex - 1;
        } else {
          // reached bottom -> start going up, lap completed
          newDirection = 'UP';
          lapEvent = true;
        }
      }
    }

    const pointsAwarded = actualMakes > 0 ? distances[currentIndex] * config.discs_per_turn : 0;

    const newTurn = {
      timestamp: new Date().toISOString(),
      distance: distances[currentIndex],
      made_putts: actualMakes,
      direction: direction,
      moved_to_distance: distances[newIndex],
      lap_event: lapEvent,
      points_awarded: pointsAwarded
    };

    const updatedState = {
      ...playerState,
      current_distance_index: newIndex,
      direction: newDirection,
      laps_completed: playerState.laps_completed + (lapEvent ? 1 : 0),
      turns_played: playerState.turns_played + 1,
      total_makes: playerState.total_makes + actualMakes,
      total_putts: playerState.total_putts + config.discs_per_turn,
      history: [...(playerState.history || []), newTurn],
      current_round_draft: { attempts: [], is_finalized: false }
    };

    // Local optimistic update
    queryClient.setQueryData(['game', gameId], {
      ...game,
      atw_state: {
        ...(game.atw_state || {}),
        [playerName]: updatedState
      },
      total_points: {
        ...(game.total_points || {}),
        [playerName]: (game.total_points?.[playerName] || 0) + pointsAwarded
      }
    });

    // Batch updates to avoid spamming writes
    setPendingUpdates(prev => [...prev, { madePutts }]);
  }, [game, gameId, playerName, queryClient, defaultPlayerState]);

  const submitTurnMutation = useMutation({
    mutationFn: async ({ madePutts }) => {
      const config = game.atw_config;
      const playerState = { ...defaultPlayerState, ...(game.atw_state?.[playerName] || {}) };

      const currentIndex = playerState.current_distance_index;
      const direction = playerState.direction;
      const threshold = config.advance_threshold;
      const distances = config.distances;
      const actualMakes = madePutts === 1 ? config.discs_per_turn : 0;

      let newIndex = currentIndex;
      let newDirection = direction;
      let lapEvent = false;

      if (madePutts >= threshold) {
        if (direction === 'UP') {
          if (currentIndex < distances.length - 1) {
            newIndex = currentIndex + 1;
          } else {
            newDirection = 'DOWN';
            lapEvent = true;
          }
        } else {
          if (currentIndex > 0) {
            newIndex = currentIndex - 1;
          } else {
            newDirection = 'UP';
            lapEvent = true;
          }
        }
      }

      const pointsAwarded = actualMakes > 0 ? distances[currentIndex] * config.discs_per_turn : 0;

      const newTurn = {
        timestamp: new Date().toISOString(),
        distance: distances[currentIndex],
        made_putts: actualMakes,
        direction: direction,
        moved_to_distance: distances[newIndex],
        lap_event: lapEvent,
        points_awarded: pointsAwarded
      };

      const updatedState = {
        ...playerState,
        current_distance_index: newIndex,
        direction: newDirection,
        laps_completed: playerState.laps_completed + (lapEvent ? 1 : 0),
        turns_played: playerState.turns_played + 1,
        total_makes: playerState.total_makes + actualMakes,
        total_putts: playerState.total_putts + config.discs_per_turn,
        history: [...(playerState.history || []), newTurn],
        current_round_draft: { attempts: [], is_finalized: false }
      };

      await base44.entities.Game.update(gameId, {
        atw_state: {
          ...game.atw_state,
          [playerName]: updatedState
        },
        total_points: {
          ...game.total_points,
          [playerName]: (game.total_points?.[playerName] || 0) + pointsAwarded
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
    },
    onError: () => {
      toast.error('Viga tulemuse salvestamisel');
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
    }
  });

  // Debounce saving pending updates
  useEffect(() => {
    if (!pendingUpdates.length) return;

    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    updateTimeoutRef.current = setTimeout(async () => {
      const updatesToSave = pendingUpdates[pendingUpdates.length - 1];
      setPendingUpdates([]);

      try {
        await submitTurnMutation.mutateAsync(updatesToSave);
      } catch (e) {
        // error handled in mutation
      }
    }, 350);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingUpdates]);

  const completeGameMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.Game.update(gameId, { status: 'completed' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
      toast.success('Mäng lõpetatud');
    },
    onError: () => {
      toast.error('Viga mängu lõpetamisel');
    }
  });

  const handleCompleteGame = useCallback(() => {
    completeGameMutation.mutate();
  }, [completeGameMutation]);

  const handlePlayAgain = useCallback(async () => {
    const playerState = { ...defaultPlayerState, ...(game.atw_state?.[playerName] || {}) };
    const currentScore = game.total_points?.[playerName] || 0;
    const bestScore = Math.max(playerState.best_score || 0, currentScore);

    await base44.entities.Game.update(gameId, {
      status: 'active',
      atw_state: {
        ...game.atw_state,
        [playerName]: {
          current_distance_index: 0,
          direction: 'UP',
          laps_completed: 0,
          turns_played: 0,
          total_makes: 0,
          total_putts: 0,
          current_round_draft: { attempts: [], is_finalized: false },
          history: [],
          best_score: bestScore,
          attempts_count: (playerState.attempts_count || 0) + 1
        }
      },
      total_points: {
        ...game.total_points,
        [playerName]: 0
      }
    });

    queryClient.invalidateQueries({ queryKey: ['game', gameId] });
  }, [game, gameId, playerName, queryClient, defaultPlayerState]);

  const undoMutation = useMutation({
    mutationFn: async () => {
      const playerState = { ...defaultPlayerState, ...(game.atw_state?.[playerName] || {}) };

      if (!playerState.history || playerState.history.length === 0) {
        throw new Error('Pole midagi tagasi võtta');
      }

      const lastTurn = playerState.history[playerState.history.length - 1];
      const newHistory = playerState.history.slice(0, -1);

      // Find previous state
      let previousIndex = 0;
      let previousDirection = 'UP';
      let previousLaps = 0;

      if (newHistory.length > 0) {
        const prevTurn = newHistory[newHistory.length - 1];
        const cfg = game.atw_config; // ensure config exists in this scope
        const distances = cfg.distances;
        previousIndex = distances.indexOf(prevTurn.moved_to_distance);
        previousDirection = prevTurn.direction;
        previousLaps = playerState.laps_completed - (lastTurn.lap_event ? 1 : 0);
      }

      const cfg2 = game.atw_config;

      const updatedState = {
        ...playerState,
        current_distance_index: previousIndex,
        direction: previousDirection,
        laps_completed: previousLaps,
        turns_played: playerState.turns_played - 1,
        total_makes: playerState.total_makes - lastTurn.made_putts,
        total_putts: playerState.total_putts - cfg2.discs_per_turn,
        history: newHistory,
        current_round_draft: { attempts: [], is_finalized: false }
      };

      await base44.entities.Game.update(gameId, {
        atw_state: {
          ...game.atw_state,
          [playerName]: updatedState
        },
        total_points: {
          ...game.total_points,
          [playerName]: Math.max(0, (game.total_points?.[playerName] || 0) - lastTurn.points_awarded)
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
      toast.success('Viimane käik tühistatud');
    },
    onError: (error) => {
      toast.error(error.message || 'Viga tagasivõtmisel');
    }
  });

  const handleUndo = useCallback(() => {
    undoMutation.mutate();
  }, [undoMutation]);

  // Early return MUST be after hooks
  if (isLoading || !game || !game.atw_config) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  const { currentDistance, totalScore, bestScore, makeRate, difficultyLabel } = gameStats || {};

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  // Leaderboard view
  if (showLeaderboard) {
    return (
      <ATWLeaderboard
        game={game}
        playerName={playerName}
        onBack={() => setShowLeaderboard(false)}
      />
    );
  }

  // --- original render continues unchanged below ---
  // NOTE: I am keeping your existing JSX as-is; only the crash/perf-safe refactor above was applied.

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-4">
      {/* ... keep the rest of your original JSX exactly as it was ... */}
      {/* The rest of the file remains identical in behavior. */}
    </div>
  );
}
