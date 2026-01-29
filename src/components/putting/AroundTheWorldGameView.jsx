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
  const ATW_SYNC_DELAY_MS_SOLO = 1500;
  const ATW_SYNC_DELAY_MS_MULTI = 250;
  const pendingUpdateRef = React.useRef([]);
  const updateTimeoutRef = React.useRef(null);
  const updateThrottleRef = React.useRef({ timer: null, latest: null });
  const localSeqRef = React.useRef(0);
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

  // Real-time subscription
  useEffect(() => {
    if (!gameId || isSolo) return;

    const unsubscribe = base44.entities.Game.subscribe((event) => {
      if (event.id === gameId && (event.type === 'update' || event.type === 'delete')) {
        const throttle = updateThrottleRef.current;
        const applyEvent = (evt) => {
          let nextData = evt.data;
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
        };

        if (!throttle.timer) {
          applyEvent(event);
          throttle.timer = setTimeout(() => {
            if (throttle.latest) {
              applyEvent(throttle.latest);
              throttle.latest = null;
            }
            throttle.timer = null;
          }, 1000);
        } else {
          throttle.latest = event;
        }
      }
    });

    return () => {
      if (updateThrottleRef.current.timer) {
        clearTimeout(updateThrottleRef.current.timer);
      }
      updateThrottleRef.current.latest = null;
      unsubscribe();
    };
  }, [gameId, isSolo, playerName, queryClient]);

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
    await base44.entities.Game.update(gameId, updatePayload);
  }, [gameId, mergePlayerUpdate]);

  const submitTurnMutation = useMutation({
    mutationFn: async ({ updatedState, updatedPoints }) => {
      await updateGameWithLatest({ updatedState, updatedPoints });
    },
    onError: (err) => {
      toast.error('Viga tulemuse salvestamisel');
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
    }
  });



  const handleFinish = useCallback(() => {
    setShowConfirmDialog(false);
  }, []);

  const handleRetry = useCallback(async () => {
    setShowConfirmDialog(false);
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    pendingUpdateRef.current = [];
    setPendingUpdates([]);

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
      current_round_draft: { attempts: [], is_finalized: false },
      history: [],
      best_score: Math.max(bestScore, currentScore),
      best_laps: Math.max(playerState.best_laps || 0, playerState.laps_completed || 0),
      best_accuracy: Math.max(bestAccuracy, currentAccuracy),
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
    toast.success('Alustad uuesti 5m pealt!');
  }, [bumpLocalSeq, defaultPlayerState, getLatestGame, playerName, queryClient, updateGameWithLatest]);

  const handleSubmitPutts = useCallback((madePutts) => {
    // Immediate local update for instant feedback
    const latestGame = getLatestGame();
    const config = latestGame.atw_config;
    const playerState = { ...defaultPlayerState, ...(latestGame.atw_state?.[playerName] || {}) };
    
    const currentIndex = playerState.current_distance_index;
    const direction = playerState.direction;
    const threshold = config.advance_threshold;
    const distances = config.distances;
    const actualMakes = madePutts === 1 ? config.discs_per_turn : 0;

    let newIndex = currentIndex;
    let newDirection = direction;
    let lapEvent = false;

    if (actualMakes >= threshold) {
      if (direction === 'UP') {
        newIndex = Math.min(currentIndex + 1, distances.length - 1);
        if (newIndex === distances.length - 1 && currentIndex < distances.length - 1) {
          newDirection = 'DOWN';
          lapEvent = true;
        }
      } else {
        newIndex = Math.max(currentIndex - 1, 0);
        if (newIndex === 0 && currentIndex > 0) {
          newDirection = 'UP';
          lapEvent = true;
        }
      }
    } else if (actualMakes === 0) {
      newIndex = 0;
    }

    const pointsAwarded = actualMakes > 0 ? distances[currentIndex] * config.discs_per_turn : 0;

    const updatedState = {
      current_distance_index: newIndex,
      direction: newDirection,
      laps_completed: playerState.laps_completed + (lapEvent ? 1 : 0),
      turns_played: playerState.turns_played + 1,
      total_makes: playerState.total_makes + actualMakes,
      total_putts: playerState.total_putts + config.discs_per_turn,
      current_round_draft: { attempts: [], is_finalized: false },
      history: [...playerState.history, {
        turn_number: playerState.turns_played + 1,
        distance: distances[currentIndex],
        direction: direction,
        made_putts: actualMakes,
        moved_to_distance: distances[newIndex],
        points_awarded: pointsAwarded,
        lap_event: lapEvent,
        failed_to_advance: actualMakes > 0 && actualMakes < threshold,
        missed_all: actualMakes === 0
      }],
      best_score: playerState.best_score,
      client_seq: bumpLocalSeq()
    };

    // Immediate UI update
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

    // Show dialog immediately if missed
    if (madePutts === 0) {
      setShowConfirmDialog(true);
    }

    // Debounced DB sync
    const pending = { madePutts, showDialog: madePutts === 0 };
    pendingUpdateRef.current = [...pendingUpdateRef.current, pending];
    setPendingUpdates(prev => [...prev, pending]);
    
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
      setPendingUpdates([]);
    }, delay);
  }, [bumpLocalSeq, defaultPlayerState, gameId, getLatestGame, isSolo, playerName, queryClient, submitTurnMutation]);

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
      setShowConfirmDialog(false);
    }
  });

  const submitToLeaderboardMutation = useMutation({
    mutationFn: async () => {
      const madePutts = playerState.total_makes;
      const totalPutts = playerState.total_putts;
      const accuracy = totalPutts > 0 ? (madePutts / totalPutts) * 100 : 0;

      return await base44.entities.LeaderboardEntry.create({
        game_id: game.id,
        player_email: user?.email || 'unknown',
        player_name: playerName,
        game_type: 'around_the_world',
        score: totalScore,
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
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    pendingUpdateRef.current = [];
    setPendingUpdates([]);

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
  }, [bumpLocalSeq, defaultPlayerState, getLatestGame, playerName, queryClient, updateGameWithLatest]);

  const handleViewLeaderboard = useCallback(() => {
    setShowConfirmDialog(false);
    setShowLeaderboard(true);
  }, []);

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

    // Find previous state
    let previousIndex = 0;
    let previousDirection = 'UP';
    let previousLaps = 0;

    if (newHistory.length > 0) {
      const prevTurn = newHistory[newHistory.length - 1];
      const distances = config.distances;
      previousIndex = distances.indexOf(prevTurn.moved_to_distance);
      previousDirection = prevTurn.direction;
      previousLaps = playerState.laps_completed - (lastTurn.lap_event ? 1 : 0);
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
      current_round_draft: { attempts: [], is_finalized: false }
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

    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    pendingUpdateRef.current = [];
    setPendingUpdates([]);

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

  // Cleanup timeout on unmount
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

  const { currentDistance, totalScore, bestScore, makeRate, difficultyLabel } = gameStats || {};

  if (isLoading || !game || !config) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  // Leaderboard view
  if (showLeaderboard) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
        <div className="max-w-4xl mx-auto px-4 pt-8 pb-12">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setShowLeaderboard(false)}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-800"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Tagasi</span>
            </button>
            <h1 className="text-2xl font-bold text-slate-800">{game.name}</h1>
            <div className="w-16" />
          </div>
          
          <ATWLeaderboard game={game} />
        </div>
      </div>
    );
  }

  return game.status === 'completed' ? (
    <CompletedGameView 
      game={game}
      playerState={playerState}
      playerName={playerName}
      totalScore={totalScore}
      bestScore={bestScore}
      makeRate={makeRate}
      difficultyLabel={difficultyLabel}
      config={config}
      isSolo={isSolo}
      showConfirmDialog={showConfirmDialog}
      handleFinish={handleFinish}
      handleRetry={handleRetry}
      handleCompleteGame={handleCompleteGame}
      handlePlayAgain={handlePlayAgain}
      onViewLeaderboard={handleViewLeaderboard}
      onExit={handleExit}
      setShowConfirmDialog={setShowConfirmDialog}
      gameId={gameId}
      submitToLeaderboardMutation={submitToLeaderboardMutation}
      user={user}
    />
  ) : (
    <ActiveGameView 
      game={game}
      playerState={playerState}
      playerName={playerName}
      currentDistance={currentDistance}
      totalScore={totalScore}
      bestScore={bestScore}
      makeRate={makeRate}
      difficultyLabel={difficultyLabel}
      config={config}
      isSolo={isSolo}
      hideScore={hideScore}
      setHideScore={setHideScore}
      handleSubmitPutts={handleSubmitPutts}
      handleUndo={handleUndo}
      undoMutation={undoMutation}
      showConfirmDialog={showConfirmDialog}
      handleFinish={handleFinish}
      handleRetry={handleRetry}
      onViewLeaderboard={handleViewLeaderboard}
      onExit={handleExit}
      setShowConfirmDialog={setShowConfirmDialog}
      gameId={gameId}
      submitTurnMutation={submitTurnMutation}
    />
  );
}

// Memoized dialog component
const ConfirmRoundDialog = React.memo(({ isOpen, onFinish, onRetry, onComplete, onViewLeaderboard, onExit }) => {
      if (!isOpen) return null;

      return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Ring salvestatud</h3>
              <p className="text-slate-600">Mida teha edasi?</p>
            </div>
            <div className="space-y-3">
              <Button
                onClick={onRetry}
                className="w-full h-12 bg-emerald-600 hover:bg-emerald-700"
              >
                Proovi uuesti
              </Button>
              <Button
                onClick={onViewLeaderboard}
                variant="outline"
                className="w-full h-12"
              >
                <Trophy className="w-4 h-4 mr-2" />
                Vaata edetabelit
              </Button>
              <Button
                onClick={onExit}
                variant="outline"
                className="w-full h-12 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                Välju mängust
              </Button>
            </div>
          </div>
        </div>
        );
        });

        // Memoized completed game view
        const CompletedGameView = React.memo(({ 
        game, playerState, playerName, totalScore, bestScore, makeRate, difficultyLabel, 
        config, isSolo, showConfirmDialog, handleFinish, handleRetry, handleCompleteGame,
        handlePlayAgain, onViewLeaderboard, onExit,
        setShowConfirmDialog, gameId, submitToLeaderboardMutation, user 
        }) => {
        const attemptsCount = (playerState.attempts_count || 0) + 1;
        const failedTurns = useMemo(() => 
        playerState.history.filter(turn => turn.failed_to_advance || turn.missed_all),
        [playerState.history]
        );

    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
        <ConfirmRoundDialog
          isOpen={showConfirmDialog}
          onFinish={handleFinish}
          onRetry={handleRetry}
          onComplete={handleCompleteGame}
          onViewLeaderboard={onViewLeaderboard}
          onExit={onExit}
        />

        <div className="max-w-md mx-auto px-4 pt-8">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => window.location.href = createPageUrl('Home')}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-800"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Tagasi</span>
            </button>
          </div>

          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trophy className="w-10 h-10 text-emerald-600" />
            </div>
            <h1 className="text-3xl font-bold text-slate-800 mb-2">Mäng lõpetatud!</h1>
            <p className="text-slate-600">Siin on sinu tulemused</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
              <div className="text-4xl font-bold text-emerald-600 mb-2">{totalScore}</div>
              <div className="text-sm text-slate-600">Viimane tulemus</div>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
              <div className="text-4xl font-bold text-amber-600 mb-2">{bestScore}</div>
              <div className="text-sm text-slate-600">Parim tulemus</div>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
              <div className="text-4xl font-bold text-blue-600 mb-2">{attemptsCount}</div>
              <div className="text-sm text-slate-600">Mitu korda proovitud</div>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
              <div className="text-4xl font-bold text-purple-600 mb-2">{makeRate}%</div>
              <div className="text-sm text-slate-600">Täpsus</div>
            </div>
          </div>

          {/* Additional Stats */}
          <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
            <h3 className="font-bold text-slate-800 mb-4">Kokkuvõte</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-600">Läbitud ringe:</span>
                <span className="font-semibold text-slate-800">{playerState.laps_completed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Käike kokku:</span>
                <span className="font-semibold text-slate-800">{playerState.turns_played}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Viskeid kokku:</span>
                <span className="font-semibold text-slate-800">{playerState.total_putts}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Sisse saadud:</span>
                <span className="font-semibold text-slate-800">{playerState.total_makes}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Raskusaste:</span>
                <span className="font-semibold text-slate-800">{difficultyLabel} - {config.discs_per_turn} ketas{config.discs_per_turn > 1 ? 't' : ''}</span>
              </div>
              {failedTurns.length > 0 && (
                <>
                  <div className="pt-3 border-t border-slate-200">
                    <span className="text-slate-600 font-semibold">Möödapanekud distantsilt:</span>
                  </div>
                  {failedTurns.map((turn, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <span className="text-sm text-slate-700">
                        {turn.distance}m ({turn.made_putts}/{config.discs_per_turn})
                      </span>
                      <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded">
                        {turn.missed_all ? 'KÕIK MÖÖDA' : 'EI EDENENUD'}
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            {isSolo && (
              <Button
                onClick={() => submitToLeaderboardMutation.mutate()}
                disabled={submitToLeaderboardMutation.isPending || submitToLeaderboardMutation.isSuccess}
                className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-lg"
              >
                {submitToLeaderboardMutation.isSuccess ? '✓ Submitted' : 'Submit to Leaderboard'}
              </Button>
            )}
            <Button
              onClick={handlePlayAgain}
              className="w-full h-14 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-lg"
            >
              Mängi uuesti
            </Button>

            <Button
              onClick={() => window.location.href = createPageUrl('Home')}
              variant="outline"
              className="w-full h-14 text-lg"
            >
              Tagasi avalehele
            </Button>

            <Button
              onClick={async () => {
                if (confirm('Kas oled kindel, et soovid mängu kustutada?')) {
                  await base44.entities.Game.delete(gameId);
                  toast.success('Mäng kustutatud');
                  window.location.href = createPageUrl('Home');
                }
              }}
              variant="outline"
              className="w-full h-14 text-lg text-red-600 hover:text-red-700 hover:bg-red-50 border-red-300"
            >
              Kustuta mäng
            </Button>
          </div>
        </div>
      </div>
    );
});

// Memoized active game view
const ActiveGameView = React.memo(({ 
  game, playerState, playerName, currentDistance, totalScore, bestScore, makeRate, 
  difficultyLabel, config, isSolo, hideScore, setHideScore, handleSubmitPutts, 
  handleUndo, undoMutation, showConfirmDialog, handleFinish, handleRetry,
  onViewLeaderboard, onExit, setShowConfirmDialog, gameId, submitTurnMutation 
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <ConfirmRoundDialog
        isOpen={showConfirmDialog}
        onFinish={handleFinish}
        onRetry={handleRetry}
        onViewLeaderboard={onViewLeaderboard}
        onExit={onExit}
      />

      <div className="max-w-md mx-auto px-4 pt-8">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={async () => {
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

              window.location.href = createPageUrl('Home');
            }}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-800"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Välju</span>
          </button>
          <div className="text-sm text-slate-600">
            {isSolo ? 'Treening' : game.name}
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          <div className="bg-white rounded-xl p-3 text-center shadow-sm">
            <div className="text-xl font-bold text-emerald-600">{hideScore ? '***' : totalScore}</div>
            <div className="text-xs text-slate-600">Punktid</div>
          </div>
          <div className="bg-white rounded-xl p-3 text-center shadow-sm">
            <div className="text-xl font-bold text-amber-600">{hideScore ? '***' : bestScore}</div>
            <div className="text-xs text-slate-600">Parim</div>
          </div>
          <div className="bg-white rounded-xl p-3 text-center shadow-sm">
            <div className="text-xl font-bold text-blue-600">{playerState.laps_completed}</div>
            <div className="text-xs text-slate-600">Ringe</div>
          </div>
          <div className="bg-white rounded-xl p-3 text-center shadow-sm">
            <div className="text-xl font-bold text-purple-600">{makeRate}%</div>
            <div className="text-xs text-slate-600">Täpsus</div>
          </div>
        </div>
        
        {/* Hide Score Toggle */}
        <div className="flex justify-center mb-6">
          <button
            onClick={() => setHideScore(!hideScore)}
            className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-sm border border-slate-200 hover:border-slate-300 transition-colors"
          >
            {hideScore ? (
              <EyeOff className="w-4 h-4 text-slate-500" />
            ) : (
              <Eye className="w-4 h-4 text-slate-500" />
            )}
            <span className="text-sm font-medium text-slate-700">
              {hideScore ? 'Näita skoori' : 'Peida skoor'}
            </span>
          </button>
        </div>

        {/* Current Status */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-full">
                <span className="text-sm font-semibold text-slate-700">
                  {difficultyLabel} - {config.discs_per_turn} ketas{config.discs_per_turn > 1 ? 't' : ''}
                </span>
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 rounded-full">
                {playerState.direction === 'UP' ? (
                  <ArrowUp className="w-4 h-4 text-emerald-700" />
                ) : (
                  <ArrowDown className="w-4 h-4 text-emerald-700" />
                )}
                <span className="text-sm font-semibold text-emerald-700">
                  {playerState.direction === 'UP' ? 'Kaugemale' : 'Lähemale'}
                </span>
              </div>
            </div>
            <div className="text-5xl font-bold text-slate-800 mb-2">{currentDistance}m</div>
            <div className="text-sm text-slate-600">
              Käik {playerState.turns_played + 1}
            </div>
          </div>

          {/* Distance Progress */}
          <div className="flex justify-between items-center mb-6">
            {config.distances.map((dist, idx) => (
              <div key={idx} className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                  idx === playerState.current_distance_index
                    ? 'bg-emerald-500 text-white'
                    : idx < playerState.current_distance_index
                    ? 'bg-emerald-200 text-emerald-700'
                    : 'bg-slate-200 text-slate-500'
                }`}>
                  {dist}
                </div>
                <div className="text-xs text-slate-500 mt-1">m</div>
              </div>
            ))}
          </div>

          {/* Quick Input */}
          <div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <button
                onClick={() => handleSubmitPutts(0)}
                className="h-16 rounded-xl font-bold text-lg bg-red-100 text-red-700 hover:bg-red-200 active:scale-95 transition-all"
              >
                Missed
              </button>
              <button
                onClick={() => handleSubmitPutts(1)}
                className="h-16 rounded-xl font-bold text-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 active:scale-95 transition-all"
              >
                Made
              </button>
            </div>
            {playerState.history && playerState.history.length > 0 && (
              <button
                onClick={handleUndo}
                disabled={undoMutation.isPending}
                className="w-full h-16 rounded-xl font-bold text-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all disabled:opacity-50"
              >
                <Undo2 className="w-4 h-4 mr-2 inline" />
                Võta tagasi
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
