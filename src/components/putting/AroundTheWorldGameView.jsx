import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowUp, ArrowDown, CheckCircle2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const ConfirmRoundDialog = ({ isOpen, onFinish, onRetry }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">Ring salvestatud</h3>
          <p className="text-slate-600">Kas see on õige?</p>
        </div>
        <div className="space-y-3">
          <Button
            onClick={onFinish}
            className="w-full h-12 bg-emerald-600 hover:bg-emerald-700"
          >
            Lõpeta ring
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
    mutationFn: async ({ madePutts, isRetry }) => {
      const config = game.atw_config;
      const playerState = game.atw_state?.[playerName] || {
        current_distance_index: 0,
        direction: 'UP',
        laps_completed: 0,
        turns_played: 0,
        total_makes: 0,
        total_putts: 0,
        current_round_draft: { attempts: [], is_finalized: false },
        history: []
      };

      // Add attempt to draft
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

      return { isRetry };
    },
    onSuccess: ({ isRetry }) => {
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
      if (!isRetry) {
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
    
    // If only 1 disc and Made, skip confirmation and finish immediately
    if (config.discs_per_turn === 1 && madePutts === 1) {
      submitTurnMutation.mutate({ madePutts, isRetry: false }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['game', gameId] });
          // Immediately finalize without showing dialog
          finishRoundMutation.mutate();
        }
      });
    } else {
      submitTurnMutation.mutate({ madePutts, isRetry: false });
    }
  };

  const handleRetry = () => {
    setShowConfirmDialog(false);
    // Allow immediate retry
  };

  const handleFinish = () => {
    finishRoundMutation.mutate();
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
  const makeRate = playerState.total_putts > 0 
    ? ((playerState.total_makes / playerState.total_putts) * 100).toFixed(0) 
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <ConfirmRoundDialog
        isOpen={showConfirmDialog}
        onFinish={handleFinish}
        onRetry={handleRetry}
      />

      <div className="max-w-md mx-auto px-4 pt-8">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate(createPageUrl('Home'))}
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
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-xl p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-emerald-600">{totalScore}</div>
            <div className="text-xs text-slate-600">Punktid</div>
          </div>
          <div className="bg-white rounded-xl p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-blue-600">{playerState.laps_completed}</div>
            <div className="text-xs text-slate-600">Ringe</div>
          </div>
          <div className="bg-white rounded-xl p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-purple-600">{makeRate}%</div>
            <div className="text-xs text-slate-600">Täpsus</div>
          </div>
        </div>

        {/* Current Status */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 rounded-full mb-3">
              {playerState.direction === 'UP' ? (
                <ArrowUp className="w-4 h-4 text-emerald-700" />
              ) : (
                <ArrowDown className="w-4 h-4 text-emerald-700" />
              )}
              <span className="text-sm font-semibold text-emerald-700">
                {playerState.direction === 'UP' ? 'Eemale' : 'Tagasi'}
              </span>
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
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleSubmitPutts(0)}
                  disabled={submitTurnMutation.isPending || finishRoundMutation.isPending}
                  className="h-16 rounded-xl font-bold text-lg bg-red-100 text-red-700 hover:bg-red-200 transition-all"
                >
                  Missed
                </button>
                <button
                  onClick={() => handleSubmitPutts(1)}
                  disabled={submitTurnMutation.isPending || finishRoundMutation.isPending}
                  className="h-16 rounded-xl font-bold text-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-all"
                >
                  Made
                </button>
              </div>
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
              </>
            )}
          </div>
        </div>

        {/* Rules Reminder */}
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <div className="text-xs text-blue-800 space-y-1">
            <div>✓ {config.advance_threshold}+ sisse = liigu edasi</div>
            <div>→ {config.advance_threshold - 1} sisse = jää samale</div>
            <div>← Alla {config.advance_threshold - 1} sisse = liigu tagasi</div>
            <div>⚠️ 0 sisse = tagasi 5m peale</div>
          </div>
        </div>
      </div>
    </div>
  );
}