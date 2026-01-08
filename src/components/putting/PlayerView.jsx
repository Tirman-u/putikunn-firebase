import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';
import OneClickScoreInput from './OneClickScoreInput';
import JylyScoreTable from './JylyScoreTable';

const MAX_ROUNDS = 20;

const getNextDistance = (made) => {
  const distanceMap = [5, 6, 7, 8, 9, 10];
  return distanceMap[made] || 10;
};

export default function PlayerView({ gameId, playerName, onExit }) {
  const [showScoreboard, setShowScoreboard] = React.useState(false);
  const queryClient = useQueryClient();

  const { data: game, isLoading } = useQuery({
    queryKey: ['game', gameId],
    queryFn: () => base44.entities.Game.list().then(games => games.find(g => g.id === gameId)),
    refetchInterval: 2000
  });

  const updateGameMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Game.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
    }
  });

  const handleScoreSubmit = ({ made, points }) => {
    const currentDistance = game.player_distances[playerName];
    
    const newRoundScores = { ...game.round_scores };
    if (!newRoundScores[playerName]) {
      newRoundScores[playerName] = [];
    }
    newRoundScores[playerName].push({
      made,
      distance: currentDistance,
      points
    });

    const newTotalPoints = { ...game.total_points };
    newTotalPoints[playerName] = (newTotalPoints[playerName] || 0) + points;

    const nextDistance = getNextDistance(made);
    const newPlayerDistances = { ...game.player_distances };
    newPlayerDistances[playerName] = nextDistance;

    updateGameMutation.mutate({
      id: game.id,
      data: {
        round_scores: newRoundScores,
        total_points: newTotalPoints,
        player_distances: newPlayerDistances
      }
    });
  };

  const handleUndo = () => {
    const playerScores = game.round_scores[playerName];
    if (!playerScores || playerScores.length === 0) return;

    const newScores = [...playerScores];
    const lastScore = newScores.pop();

    const newRoundScores = { ...game.round_scores };
    newRoundScores[playerName] = newScores;

    const newTotalPoints = { ...game.total_points };
    newTotalPoints[playerName] = (newTotalPoints[playerName] || 0) - lastScore.points;

    // Calculate previous distance
    const prevDistance = newScores.length > 0 
      ? getNextDistance(newScores[newScores.length - 1].made)
      : 10;

    const newPlayerDistances = { ...game.player_distances };
    newPlayerDistances[playerName] = prevDistance;

    updateGameMutation.mutate({
      id: game.id,
      data: {
        round_scores: newRoundScores,
        total_points: newTotalPoints,
        player_distances: newPlayerDistances
      }
    });
  };

  if (isLoading || !game) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  const currentRound = (game.round_scores?.[playerName]?.length || 0) + 1;
  const currentDistance = game.player_distances?.[playerName] || 10;
  const canUndo = (game.round_scores?.[playerName]?.length || 0) > 0;
  const isComplete = currentRound > MAX_ROUNDS;

  // Scoreboard View
  if (showScoreboard) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
        <div className="max-w-4xl mx-auto p-4">
          <div className="flex items-center justify-between mb-6 pt-4">
            <button
              onClick={() => setShowScoreboard(false)}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-800"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Back</span>
            </button>
            <h2 className="text-xl font-bold text-slate-800">Scoreboard</h2>
            <div className="w-16" />
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <JylyScoreTable 
              players={game.players}
              roundScores={game.round_scores}
              totalPoints={game.total_points}
              playerDistances={game.player_distances}
              currentRound={Math.max(...game.players.map(p => (game.round_scores?.[p]?.length || 0) + 1))}
            />
          </div>
        </div>
      </div>
    );
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
            <h1 className="text-4xl font-bold text-slate-800 mb-4">🎉 Complete!</h1>
            <p className="text-xl text-slate-600 mb-2">You finished all 20 rounds</p>
            <p className="text-4xl font-bold text-emerald-600">{game.total_points[playerName]} points</p>
          </motion.div>

          <div className="space-y-3">
            <Button
              onClick={() => setShowScoreboard(true)}
              className="w-full h-14 bg-slate-600 hover:bg-slate-700 rounded-xl"
            >
              <Trophy className="w-5 h-5 mr-2" />
              View Scoreboard
            </Button>
            <Button
              onClick={onExit}
              variant="outline"
              className="w-full h-14 rounded-xl"
            >
              Exit Game
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Scoring View
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <div className="max-w-lg mx-auto p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pt-4">
          <button
            onClick={onExit}
            className="text-slate-600 hover:text-slate-800"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <h2 className="text-lg font-bold text-slate-800">{game.name}</h2>
            <p className="text-sm text-slate-500">Round {currentRound} of {MAX_ROUNDS}</p>
          </div>
          <button
            onClick={() => setShowScoreboard(true)}
            className="text-emerald-600 hover:text-emerald-700"
          >
            <Trophy className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-500"
              style={{ width: `${((currentRound - 1) / MAX_ROUNDS) * 100}%` }}
            />
          </div>
        </div>

        {/* Your Stats */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-6">
          <div className="flex items-center justify-around">
            <div className="text-center">
              <div className="text-sm text-slate-500">Your Points</div>
              <div className="text-3xl font-bold text-emerald-600">
                {game.total_points[playerName] || 0}
              </div>
            </div>
            <div className="h-12 w-px bg-slate-200" />
            <div className="text-center">
              <div className="text-sm text-slate-500">Rounds Done</div>
              <div className="text-3xl font-bold text-slate-600">
                {currentRound - 1}
              </div>
            </div>
          </div>
        </div>

        {/* Score Input */}
        <OneClickScoreInput
          player={playerName}
          currentDistance={currentDistance}
          onSubmit={handleScoreSubmit}
          canUndo={canUndo}
          onUndo={handleUndo}
        />
      </div>
    </div>
  );
}