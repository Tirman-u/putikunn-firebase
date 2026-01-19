import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowUp, ArrowDown, CheckCircle2, X, Undo2, Trophy, RotateCcw, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const ConfirmRoundDialog = ({ isOpen, onFinish, onRetry, onComplete }) => {
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
            onClick={onFinish}
            className="w-full h-12 bg-emerald-600 hover:bg-emerald-700"
          >
            Jätka mängu
          </Button>
          <Button
            onClick={onComplete}
            variant="outline"
            className="w-full h-12 border-amber-300 text-amber-700 hover:bg-amber-50"
          >
            <Trophy className="w-4 h-4 mr-2" />
            Lõpeta mäng
          </Button>
          <Button
            onClick={onRetry}
            variant="outline"
            className="w-full h-12"
          >
            Proovi uuesti
          </Button>
        </div>
      </div>
    </div>
  );
};

export default function AroundTheWorldGameView({ gameId, playerName, isSolo }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingMadePutts, setPendingMadePutts] = useState(null);

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: game, isLoading } = useQuery({
    queryKey: ['game', gameId],
    queryFn: async () => {
      const games = await base44.entities.Game.list();
      return games.find(g => g.id === gameId);
    },
    refetchInterval: 2000
  });

  const submitTurnMutation = useMutation({
    mutationFn: async ({ madePutts }) => {
      const config = game.atw_config;
      const playerState = game.atw_state?.[playerName] || {
        current_distance_index: 0,
        direction: 'UP',
        laps_completed: 0,
        turns_played: 0,
        total_makes: 0,
        total_putts: 0,
        current_round_draft: { attempts: [], is_finalized: false },
        history: [],
        best_score: 0
      };

      // For 1 disc mode with made putt - finalize immediately
      if (config.discs_per_turn === 1 && madePutts === 1) {
        const currentIndex = playerState.current_distance_index;
        const direction = playerState.direction;
        const threshold = config.advance_threshold;
        const distances = config.distances;

        let newIndex = currentIndex;
        let newDirection = direction;
        let lapEvent = false;

        // Advance
        if (direction === 'UP') {
          newIndex = Math.min(currentIndex + 1, distances.length - 1);
          if (newIndex === distances.length - 1 && currentIndex < distances.length - 1) {
            newDirection = 'DOWN';
          }
        } else {
          newIndex = Math.max(currentIndex - 1, 0);
          if (newIndex === 0 && currentIndex > 0) {
            newDirection = 'UP';
            lapEvent = true;
          }
        }

        const pointsAwarded = distances[currentIndex];

        const updatedState = {
          current_distance_index: newIndex,
          direction: newDirection,
          laps_completed: playerState.laps_completed + (lapEvent ? 1 : 0),
          turns_played: playerState.turns_played + 1,
          total_makes: playerState.total_makes + madePutts,
          total_putts: playerState.total_putts + 1,
          current_round_draft: { attempts: [], is_finalized: false },
          history: [...playerState.history, {
            turn_number: playerState.turns_played + 1,
            distance: distances[currentIndex],
            direction: direction,
            made_putts: madePutts,
            moved_to_distance: distances[newIndex],
            points_awarded: pointsAwarded,
            lap_event: lapEvent
          }],
          best_score: playerState.best_score
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

        return { showDialog: false };
      } else {
        // For miss or multi-disc mode - save to draft
        const newAttempt = {
          made_putts: madePutts,
          timestamp: new Date().toISOString()
        };

        const updatedDraft = {
          ...playerState.current_round_draft,
          attempts: [...(playerState.current_round_draft?.attempts || []), newAttempt]
        };

        const updatedState = {
          ...playerState,
          current_round_draft: updatedDraft
        };

        await base44.entities.Game.update(gameId, {
          atw_state: {
            ...game.atw_state,
            [playerName]: updatedState
          }
        });

        return { showDialog: true };
      }
    },
    onSuccess: ({ showDialog }) => {
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
      if (showDialog) {
        setShowConfirmDialog(true);
      }
    }
  });

  const finishRoundMutation = useMutation({
    mutationFn: async () => {
      const config = game.atw_config;
      const playerState = game.atw_state[playerName];
      const draft = playerState.current_round_draft;

      // Find best attempt
      const bestAttempt = draft.attempts.reduce((best, curr) => 
        curr.made_putts > best.made_putts ? curr : best
      );

      const madePutts = bestAttempt.made_putts;
      const currentIndex = playerState.current_distance_index;
      const direction = playerState.direction;
      const threshold = config.advance_threshold;
      const distances = config.distances;

      // Movement logic
      let newIndex = currentIndex;
      let newDirection = direction;
      let lapEvent = false;

      if (madePutts >= threshold) {
        // Advance
        if (direction === 'UP') {
          newIndex = Math.min(currentIndex + 1, distances.length - 1);
          if (newIndex === distances.length - 1 && currentIndex < distances.length - 1) {
            newDirection = 'DOWN';
          }
        } else {
          newIndex = Math.max(currentIndex - 1, 0);
          if (newIndex === 0 && currentIndex > 0) {
            newDirection = 'UP';
            lapEvent = true;
          }
        }
      } else if (madePutts === threshold - 1) {
        // Stay
      } else if (madePutts > 0 && madePutts < threshold - 1) {
        // Move back
        if (direction === 'UP') {
          newIndex = Math.max(currentIndex - 1, 0);
        } else {
          newIndex = Math.min(currentIndex + 1, distances.length - 1);
        }
      } else if (madePutts === 0) {
        // Reset to 5m
        newIndex = 0;
      }

      const pointsAwarded = distances[currentIndex];

      // Create turn record
      const turnRecord = {
        turn_number: playerState.turns_played + 1,
        distance: distances[currentIndex],
        direction: direction,
        made_putts: madePutts,
        moved_to_distance: distances[newIndex],
        points_awarded: pointsAwarded,
        lap_event: lapEvent
      };

      // Update state
      const updatedState = {
        current_distance_index: newIndex,
        direction: newDirection,
        laps_completed: playerState.laps_completed + (lapEvent ? 1 : 0),
        turns_played: playerState.turns_played + 1,
        total_makes: playerState.total_makes + madePutts,
        total_putts: playerState.total_putts + config.discs_per_turn,
        current_round_draft: { attempts: [], is_finalized: false },
        history: [...playerState.history, turnRecord]
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
      setShowConfirmDialog(false);
      setPendingMadePutts(null);
      toast.success('Ring lõpetatud!');
    }
  });

  const handleSubmitPutts = (madePutts) => {
    setPendingMadePutts(madePutts);
    submitTurnMutation.mutate({ madePutts });
  };

  const handleRetry = async () => {
    setShowConfirmDialog(false);
    
    // Reset player to starting position
    const playerState = game.atw_state[playerName];
    const currentScore = game.total_points?.[playerName] || 0;
    const bestScore = game.atw_state[playerName]?.best_score || 0;
    
    const resetState = {
      current_distance_index: 0,
      direction: 'UP',
      laps_completed: 0,
      turns_played: 0,
      total_makes: 0,
      total_putts: 0,
      current_round_draft: { attempts: [], is_finalized: false },
      history: [],
      best_score: Math.max(bestScore, currentScore)
    };
    
    await base44.entities.Game.update(gameId, {
      atw_state: {
        ...game.atw_state,
        [playerName]: resetState
      },
      total_points: {
        ...game.total_points,
        [playerName]: 0
      }
    });
    
    queryClient.invalidateQueries({ queryKey: ['game', gameId] });
    toast.success('Alustad uuesti 5m pealt!');
  };

  const handleFinish = () => {
    setShowConfirmDialog(false);
  };

  const completeGameMutation = useMutation({
    mutationFn: async () => {
      const playerState = game.atw_state[playerName];
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

  const handleCompleteGame = () => {
    completeGameMutation.mutate();
  };

  const handlePlayAgain = async () => {
    const playerState = game.atw_state[playerName];
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
  };

  const undoMutation = useMutation({
    mutationFn: async () => {
      const playerState = game.atw_state[playerName];
      
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

  const handleUndo = () => {
    undoMutation.mutate();
  };

  if (isLoading || !game) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  const config = game.atw_config;
  const playerState = game.atw_state?.[playerName] || {
    current_distance_index: 0,
    direction: 'UP',
    laps_completed: 0,
    turns_played: 0,
    total_makes: 0,
    total_putts: 0,
    history: []
  };

  const currentDistance = config.distances[playerState.current_distance_index];
  const totalScore = game.total_points?.[playerName] || 0;
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

  // Completed game view
  if (game.status === 'completed') {
    const attemptsCount = (playerState.attempts_count || 0) + 1;
    
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
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
              <div className="text-sm text-slate-600">Proovitud kordi</div>
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
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              onClick={handlePlayAgain}
              className="w-full h-14 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-lg"
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              Mängi uuesti
            </Button>
            
            <Button
              onClick={() => window.location.href = createPageUrl('Home')}
              variant="outline"
              className="w-full h-14 text-lg"
            >
              Tagasi avalehele
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <ConfirmRoundDialog
        isOpen={showConfirmDialog}
        onFinish={handleFinish}
        onRetry={handleRetry}
        onComplete={handleCompleteGame}
      />

      <div className="max-w-md mx-auto px-4 pt-8">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => window.location.href = createPageUrl('Home')}
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
            <div className="text-xl font-bold text-emerald-600">{totalScore}</div>
            <div className="text-xs text-slate-600">Punktid</div>
          </div>
          <div className="bg-white rounded-xl p-3 text-center shadow-sm">
            <div className="text-xl font-bold text-amber-600">{bestScore}</div>
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
            {config.discs_per_turn === 1 ? (
              <>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <button
                    onClick={() => handleSubmitPutts(0)}
                    disabled={submitTurnMutation.isPending || finishRoundMutation.isPending}
                    className="h-16 rounded-xl font-bold text-lg bg-red-100 text-red-700 hover:bg-red-200 transition-all disabled:opacity-50"
                  >
                    Missed
                  </button>
                  <button
                    onClick={() => handleSubmitPutts(1)}
                    disabled={submitTurnMutation.isPending || finishRoundMutation.isPending}
                    className="h-16 rounded-xl font-bold text-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-all disabled:opacity-50"
                  >
                    Made
                  </button>
                </div>
                {playerState.history && playerState.history.length > 0 && (
                  <Button
                    onClick={handleUndo}
                    disabled={undoMutation.isPending}
                    variant="outline"
                    className="w-full h-12"
                  >
                    <Undo2 className="w-4 h-4 mr-2" />
                    Võta tagasi
                  </Button>
                )}
              </>
            ) : (
              <>
                <div className="text-sm font-medium text-slate-700 mb-3">
                  Mitu sisse said? (vaja {config.advance_threshold}+)
                </div>
                <div className="grid grid-cols-6 gap-2">
                  {Array.from({ length: config.discs_per_turn + 1 }, (_, i) => i).map(num => (
                    <button
                      key={num}
                      onClick={() => handleSubmitPutts(num)}
                      disabled={submitTurnMutation.isPending}
                      className={`h-14 rounded-xl font-bold text-lg transition-all ${
                        num === 0
                          ? 'bg-red-100 text-red-700 hover:bg-red-200'
                          : num >= config.advance_threshold
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
                {playerState.history && playerState.history.length > 0 && (
                  <Button
                    onClick={handleUndo}
                    disabled={undoMutation.isPending}
                    variant="outline"
                    className="w-full h-12 mt-3"
                  >
                    <Undo2 className="w-4 h-4 mr-2" />
                    Võta tagasi
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}