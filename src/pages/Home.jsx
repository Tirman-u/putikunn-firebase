import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ChevronRight, RotateCcw, Trophy, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import GameSetup from '@/components/putting/GameSetup';
import ScoreTable from '@/components/putting/ScoreTable';
import ScoreInput from '@/components/putting/ScoreInput';

export default function Home() {
  const [currentGame, setCurrentGame] = useState(null);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [view, setView] = useState('setup'); // setup, scoring, table

  const queryClient = useQueryClient();

  // Create game mutation
  const createGameMutation = useMutation({
    mutationFn: (gameData) => base44.entities.Game.create({
      ...gameData,
      scores: Object.fromEntries(gameData.players.map(p => [p, []])),
      current_round: 1,
      status: 'active'
    }),
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

  const handleScoreSubmit = (score) => {
    const player = currentGame.players[currentPlayerIndex];
    const newScores = { ...currentGame.scores };
    const roundIndex = currentGame.current_round - 1;
    
    // Initialize player scores array if needed
    if (!newScores[player]) {
      newScores[player] = [];
    }
    
    // Set score for current round
    newScores[player][roundIndex] = score;

    // Check if all players have scored this round
    const allScored = currentGame.players.every(p => 
      newScores[p] && newScores[p][roundIndex] !== undefined
    );

    let nextRound = currentGame.current_round;
    let nextPlayerIndex = currentPlayerIndex;

    if (allScored) {
      // Move to next round
      nextRound = currentGame.current_round + 1;
      nextPlayerIndex = 0;
    } else {
      // Move to next player
      nextPlayerIndex = currentPlayerIndex + 1;
    }

    updateGameMutation.mutate({
      id: currentGame.id,
      data: {
        scores: newScores,
        current_round: nextRound
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

  // Score Table View
  if (view === 'table') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
        <div className="max-w-4xl mx-auto p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 pt-4">
            <button
              onClick={handleBackToScoring}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-800"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Back</span>
            </button>
            <h2 className="text-xl font-bold text-slate-800">
              {currentGame?.name || 'Scoreboard'}
            </h2>
            <div className="w-20" />
          </div>

          {/* Round Indicator */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-6">
            <div className="flex items-center justify-center gap-3">
              <span className="text-sm text-slate-500">Current Round</span>
              <span className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center text-lg font-bold">
                {currentGame?.current_round || 1}
              </span>
            </div>
          </div>

          {/* Score Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <ScoreTable 
              players={currentGame?.players || []}
              scores={currentGame?.scores || {}}
              currentRound={currentGame?.current_round || 0}
              puttsPerRound={currentGame?.putts_per_round || 10}
            />
          </div>

          {/* New Game Button */}
          <div className="mt-6">
            <Button
              onClick={handleNewGame}
              variant="outline"
              className="w-full h-14 rounded-xl border-2"
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              New Game
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Scoring View
  const currentPlayer = currentGame?.players?.[currentPlayerIndex];

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <div className="max-w-lg mx-auto p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pt-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">{currentGame?.name}</h2>
            <p className="text-sm text-slate-500">Round {currentGame?.current_round}</p>
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

        {/* Player Progress */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {currentGame?.players?.map((player, index) => {
            const hasScored = currentGame.scores?.[player]?.[currentGame.current_round - 1] !== undefined;
            const isCurrent = index === currentPlayerIndex;
            
            return (
              <div
                key={player}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  isCurrent
                    ? 'bg-emerald-500 text-white shadow-md'
                    : hasScored
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {player}
                {hasScored && !isCurrent && ' ✓'}
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
            <ScoreInput
              player={currentPlayer}
              maxScore={currentGame?.putts_per_round || 10}
              onSubmit={handleScoreSubmit}
            />
          </motion.div>
        </AnimatePresence>

        {/* View Table Button */}
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