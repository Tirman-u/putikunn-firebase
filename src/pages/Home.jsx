import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ChevronRight, RotateCcw, Trophy, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import GameSetup from '@/components/putting/GameSetup';
import JylyScoreTable from '@/components/putting/JylyScoreTable';
import JylyScoreInput from '@/components/putting/JylyScoreInput';

const MAX_ROUNDS = 20;

// Helper function to determine next distance based on made putts
const getNextDistance = (made) => {
  const distanceMap = [5, 6, 7, 8, 9, 10];
  return distanceMap[made] || 10;
};

export default function Home() {
  const [currentGame, setCurrentGame] = useState(null);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [view, setView] = useState('setup'); // setup, scoring, table, completed

  // Create game mutation
  const createGameMutation = useMutation({
    mutationFn: (gameData) => {
      // Initialize all players at 10m
      const playerDistances = {};
      const roundScores = {};
      const totalPoints = {};
      
      gameData.players.forEach(player => {
        playerDistances[player] = 10;
        roundScores[player] = [];
        totalPoints[player] = 0;
      });

      return base44.entities.Game.create({
        name: gameData.name,
        players: gameData.players,
        player_distances: playerDistances,
        round_scores: roundScores,
        total_points: totalPoints,
        current_round: 1,
        status: 'active'
      });
    },
    onSuccess: (data) => {
      setCurrentGame(data);
      setView('scoring');
      setCurrentPlayerIndex(0);
    }
  });

  // Update game mutation
  const updateGameMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Game.update(id, data),
    onSuccess: (data) => {
      setCurrentGame(data);
    }
  });

  const handleStartGame = (gameData) => {
    createGameMutation.mutate(gameData);
  };

  const handleScoreSubmit = ({ made, points }) => {
    const player = currentGame.players[currentPlayerIndex];
    const currentDistance = currentGame.player_distances[player];
    
    // Update round scores
    const newRoundScores = { ...currentGame.round_scores };
    if (!newRoundScores[player]) {
      newRoundScores[player] = [];
    }
    newRoundScores[player].push({
      made,
      distance: currentDistance,
      points
    });

    // Update total points
    const newTotalPoints = { ...currentGame.total_points };
    newTotalPoints[player] = (newTotalPoints[player] || 0) + points;

    // Calculate next distance for this player
    const nextDistance = getNextDistance(made);
    const newPlayerDistances = { ...currentGame.player_distances };
    newPlayerDistances[player] = nextDistance;

    // Check if all players have completed this round
    const allCompleted = currentGame.players.every(p => 
      newRoundScores[p] && newRoundScores[p].length >= currentGame.current_round
    );

    let nextRound = currentGame.current_round;
    let nextPlayerIndex = currentPlayerIndex;
    let newStatus = currentGame.status;

    if (allCompleted) {
      // Move to next round or complete game
      if (currentGame.current_round >= MAX_ROUNDS) {
        newStatus = 'completed';
        setView('completed');
      } else {
        nextRound = currentGame.current_round + 1;
        nextPlayerIndex = 0;
      }
    } else {
      // Move to next player
      nextPlayerIndex = currentPlayerIndex + 1;
    }

    updateGameMutation.mutate({
      id: currentGame.id,
      data: {
        round_scores: newRoundScores,
        total_points: newTotalPoints,
        player_distances: newPlayerDistances,
        current_round: nextRound,
        status: newStatus
      }
    });

    setCurrentPlayerIndex(nextPlayerIndex);
  };

  const handleNewGame = () => {
    setCurrentGame(null);
    setView('setup');
    setCurrentPlayerIndex(0);
  };

  const handleViewTable = () => {
    setView('table');
  };

  const handleBackToScoring = () => {
    setView('scoring');
  };

  // Setup View
  if (view === 'setup') {
    return <GameSetup onStartGame={handleStartGame} />;
  }

  // Completed View
  if (view === 'completed') {
    const sortedPlayers = [...currentGame.players].sort((a, b) => 
      (currentGame.total_points[b] || 0) - (currentGame.total_points[a] || 0)
    );
    const winner = sortedPlayers[0];

    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
        <div className="max-w-lg mx-auto p-4 pt-12">
          {/* Winner Display */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center mb-8"
          >
            <div className="w-32 h-32 bg-gradient-to-br from-amber-400 to-amber-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-amber-300">
              <Trophy className="w-16 h-16 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-slate-800 mb-2">Game Complete!</h1>
            <p className="text-xl text-amber-600 font-semibold mb-1">🎉 {winner} wins!</p>
            <p className="text-3xl font-bold text-amber-700">{currentGame.total_points[winner]} points</p>
          </motion.div>

          {/* Final Standings */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden mb-6">
            <div className="p-4 border-b bg-slate-50">
              <h3 className="font-bold text-slate-800">Final Standings</h3>
            </div>
            <div className="p-4 space-y-3">
              {sortedPlayers.map((player, index) => (
                <div key={player} className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600">
                      {index + 1}
                    </div>
                    <span className="font-semibold text-slate-800">{player}</span>
                  </div>
                  <span className="text-xl font-bold text-emerald-600">
                    {currentGame.total_points[player]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Button
              onClick={handleViewTable}
              className="w-full h-14 bg-slate-600 hover:bg-slate-700 rounded-xl"
            >
              <Trophy className="w-5 h-5 mr-2" />
              View Full Scoreboard
            </Button>
            <Button
              onClick={handleNewGame}
              className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 rounded-xl"
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              New Game
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Score Table View
  if (view === 'table') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
        <div className="max-w-6xl mx-auto p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 pt-4">
            <button
              onClick={currentGame.status === 'completed' ? handleNewGame : handleBackToScoring}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-800"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">{currentGame.status === 'completed' ? 'New Game' : 'Back'}</span>
            </button>
            <h2 className="text-xl font-bold text-slate-800">
              {currentGame?.name || 'Scoreboard'}
            </h2>
            <div className="w-20" />
          </div>

          {/* Round Indicator */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-6">
            <div className="flex items-center justify-center gap-4">
              <div className="text-center">
                <span className="text-sm text-slate-500 block">Current Round</span>
                <span className="text-2xl font-bold text-emerald-600">
                  {Math.min(currentGame?.current_round || 1, MAX_ROUNDS)}
                </span>
              </div>
              <div className="h-8 w-px bg-slate-200" />
              <div className="text-center">
                <span className="text-sm text-slate-500 block">Total Rounds</span>
                <span className="text-2xl font-bold text-slate-400">{MAX_ROUNDS}</span>
              </div>
            </div>
          </div>

          {/* Score Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <JylyScoreTable 
              players={currentGame?.players || []}
              roundScores={currentGame?.round_scores || {}}
              totalPoints={currentGame?.total_points || {}}
              playerDistances={currentGame?.player_distances || {}}
              currentRound={currentGame?.current_round || 1}
            />
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex gap-3">
            {currentGame.status === 'completed' ? (
              <Button
                onClick={handleNewGame}
                className="flex-1 h-14 bg-emerald-600 hover:bg-emerald-700 rounded-xl"
              >
                <RotateCcw className="w-5 h-5 mr-2" />
                New Game
              </Button>
            ) : (
              <Button
                onClick={handleBackToScoring}
                className="flex-1 h-14 bg-emerald-600 hover:bg-emerald-700 rounded-xl"
              >
                Continue Scoring
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Scoring View
  const currentPlayer = currentGame?.players?.[currentPlayerIndex];
  const currentDistance = currentGame?.player_distances?.[currentPlayer] || 10;

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <div className="max-w-lg mx-auto p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pt-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">{currentGame?.name}</h2>
            <p className="text-sm text-slate-500">Round {currentGame?.current_round} of {MAX_ROUNDS}</p>
          </div>
          <Button
            onClick={handleViewTable}
            variant="outline"
            className="rounded-xl"
          >
            <Trophy className="w-4 h-4 mr-2" />
            Scores
          </Button>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-500"
              style={{ width: `${((currentGame?.current_round - 1) / MAX_ROUNDS) * 100}%` }}
            />
          </div>
        </div>

        {/* Player Progress */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {currentGame?.players?.map((player, index) => {
            const hasScored = currentGame.round_scores?.[player]?.length >= currentGame.current_round;
            const isCurrent = index === currentPlayerIndex;
            const playerDist = currentGame.player_distances?.[player] || 10;
            
            return (
              <div
                key={player}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  isCurrent
                    ? 'bg-emerald-500 text-white shadow-md ring-2 ring-emerald-300'
                    : hasScored
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                <div>{player}</div>
                <div className="text-[10px] opacity-75">{playerDist}m</div>
                {hasScored && !isCurrent && <span className="ml-1">✓</span>}
              </div>
            );
          })}
        </div>

        {/* Score Input */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${currentPlayer}-${currentGame?.current_round}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <JylyScoreInput
              player={currentPlayer}
              currentDistance={currentDistance}
              onSubmit={handleScoreSubmit}
            />
          </motion.div>
        </AnimatePresence>

        {/* View Table Link */}
        <Button
          onClick={handleViewTable}
          variant="ghost"
          className="w-full mt-4 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
        >
          View Full Scoreboard
          <ChevronRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </div>
  );
}