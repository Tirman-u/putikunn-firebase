import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trophy, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { createPageUrl } from '@/utils';
import ClassicScoreInput from './ClassicScoreInput';
import BackAndForthInput from './BackAndForthInput';
import JylyScoreTable from './JylyScoreTable';
import ProgressBar from './ProgressBar';
import MobileLeaderboard from './MobileLeaderboard';
import PuttTypeSelector from './PuttTypeSelector';
import { 
  GAME_FORMATS, 
  getNextDistanceFromMade, 
  getNextDistanceBackAndForth,
  getNextDistanceStreak,
  calculateRoundScore,
  isGameComplete 
} from './gameRules';

export default function PlayerView({ gameId, playerName, onExit }) {
  const [showLeaderboard, setShowLeaderboard] = React.useState(false);
  const [hasSubmitted, setHasSubmitted] = React.useState(false);
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => base44.auth.me()
  });

  const { data: game, isLoading } = useQuery({
    queryKey: ['game', gameId],
    queryFn: () => base44.entities.Game.list().then(games => games.find(g => g.id === gameId)),
    refetchInterval: 2000
  });

  const updateGameMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Game.update(id, data),
    onSuccess: (updatedGame) => {
      // Update cache immediately with the response
      queryClient.setQueryData(['game', gameId], updatedGame);
    }
  });

  const submitToLeaderboardMutation = useMutation({
    mutationFn: async () => {
      const playerPutts = game.player_putts?.[playerName] || [];
      const madePutts = playerPutts.filter(p => p.result === 'made').length;
      const totalPutts = playerPutts.length;
      const accuracy = totalPutts > 0 ? (madePutts / totalPutts) * 100 : 0;

      return await base44.entities.LeaderboardEntry.create({
        game_id: game.id,
        player_email: user?.email || 'unknown',
        player_name: playerName,
        game_type: game.game_type,
        score: game.total_points[playerName] || 0,
        accuracy: Math.round(accuracy * 10) / 10,
        made_putts: madePutts,
        total_putts: totalPutts,
        leaderboard_type: 'general',
        player_gender: user?.gender || 'M',
        date: new Date().toISOString()
      });
    },
    onSuccess: () => {
      setHasSubmitted(true);
      toast.success('Result submitted to leaderboard!');
    }
  });

  // Handle Classic/Short/Long/Random format submission (5 putts at once)
  const handleClassicSubmit = (madeCount) => {
    const gameType = game.game_type || 'classic';
    const format = GAME_FORMATS[gameType];
    const currentDistance = game.player_distances[playerName];
    
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

    const allPlayerPutts = { ...game.player_putts };
    if (!allPlayerPutts[playerName]) {
      allPlayerPutts[playerName] = [];
    }
    allPlayerPutts[playerName].push(...newPutts);

    // Calculate round score
    const roundScore = calculateRoundScore(currentDistance, madeCount);
    
    const newTotalPoints = { ...game.total_points };
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

    const newPlayerDistances = { ...game.player_distances };
    newPlayerDistances[playerName] = nextDistance;

    updateGameMutation.mutate({
      id: game.id,
      data: {
        player_putts: allPlayerPutts,
        total_points: newTotalPoints,
        player_distances: newPlayerDistances
      }
    });
  };

  // Handle Back & Forth / Streak / Random format (1 putt at a time)
  const handleBackAndForthPutt = (wasMade) => {
    const gameType = game.game_type || 'classic';
    const format = GAME_FORMATS[gameType];
    const currentDistance = game.player_distances[playerName];
    const result = wasMade ? 'made' : 'missed';
    const points = wasMade ? currentDistance : 0;

    const newPutt = {
      distance: currentDistance,
      result,
      points,
      timestamp: new Date().toISOString(),
      putt_type: game.putt_type || 'regular'
    };

    const allPlayerPutts = { ...game.player_putts };
    if (!allPlayerPutts[playerName]) {
      allPlayerPutts[playerName] = [];
    }
    allPlayerPutts[playerName].push(newPutt);

    const newTotalPoints = { ...game.total_points };
    newTotalPoints[playerName] = (newTotalPoints[playerName] || 0) + points;

    // Calculate next distance based on format
    let nextDistance;
    if (gameType === 'back_and_forth') {
      nextDistance = getNextDistanceBackAndForth(currentDistance, wasMade);
    } else if (gameType === 'streak_challenge') {
      nextDistance = format.startDistance; // Always same distance for streak
    } else {
      nextDistance = currentDistance;
    }

    const newPlayerDistances = { ...game.player_distances };
    newPlayerDistances[playerName] = nextDistance;

    updateGameMutation.mutate({
      id: game.id,
      data: {
        player_putts: allPlayerPutts,
        total_points: newTotalPoints,
        player_distances: newPlayerDistances
      }
    });
  };

  const handleUndo = () => {
    const playerPutts = game.player_putts?.[playerName];
    if (!playerPutts || playerPutts.length === 0) return;

    const gameType = game.game_type || 'classic';
    const format = GAME_FORMATS[gameType];
    const newPutts = [...playerPutts];

    if (format.singlePuttMode) {
      // Back & Forth: remove 1 putt
      const lastPutt = newPutts.pop();
      
      const allPlayerPutts = { ...game.player_putts };
      allPlayerPutts[playerName] = newPutts;

      const newTotalPoints = { ...game.total_points };
      newTotalPoints[playerName] = (newTotalPoints[playerName] || 0) - lastPutt.points;

      // Recalculate distance from previous putt
      let prevDistance = format.startDistance;
      if (newPutts.length > 0) {
        prevDistance = newPutts[newPutts.length - 1].distance;
      }

      const newPlayerDistances = { ...game.player_distances };
      newPlayerDistances[playerName] = prevDistance;

      updateGameMutation.mutate({
        id: game.id,
        data: {
          player_putts: allPlayerPutts,
          total_points: newTotalPoints,
          player_distances: newPlayerDistances
        }
      });
    } else {
      // Classic/Short/Long: remove last 5 putts (1 round)
      const lastRoundPutts = newPutts.splice(-5);
      const madeCount = lastRoundPutts.filter(p => p.result === 'made').length;
      const roundDistance = lastRoundPutts[0].distance;
      const roundScore = calculateRoundScore(roundDistance, madeCount);

      const allPlayerPutts = { ...game.player_putts };
      allPlayerPutts[playerName] = newPutts;

      const newTotalPoints = { ...game.total_points };
      newTotalPoints[playerName] = (newTotalPoints[playerName] || 0) - roundScore;

      // Recalculate distance from previous round
      let prevDistance = format.startDistance;
      if (newPutts.length >= 5) {
        const prevRoundPutts = newPutts.slice(-5);
        const prevMade = prevRoundPutts.filter(p => p.result === 'made').length;
        prevDistance = getNextDistanceFromMade(gameType, prevMade);
      }

      const newPlayerDistances = { ...game.player_distances };
      newPlayerDistances[playerName] = prevDistance;

      updateGameMutation.mutate({
        id: game.id,
        data: {
          player_putts: allPlayerPutts,
          total_points: newTotalPoints,
          player_distances: newPlayerDistances
        }
      });
    }
  };

  if (isLoading || !game) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  const gameType = game.game_type || 'classic';
  const format = GAME_FORMATS[gameType];
  const playerPutts = game.player_putts?.[playerName] || [];
  const currentDistance = game.player_distances?.[playerName] || format.startDistance;
  const canUndo = playerPutts.length > 0;
  const isComplete = isGameComplete(gameType, playerPutts.length);

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
            <p className="text-xl text-slate-600 mb-2">You finished all rounds</p>
            <p className="text-4xl font-bold text-emerald-600">{game.total_points[playerName]} points</p>
          </motion.div>

          <div className="space-y-3">
            {!hasSubmitted && (
              <Button
                onClick={() => submitToLeaderboardMutation.mutate()}
                disabled={submitToLeaderboardMutation.isPending}
                className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 rounded-xl"
              >
                <Upload className="w-5 h-5 mr-2" />
                Submit to Leaderboard
              </Button>
            )}
            <Button
              onClick={() => window.location.href = createPageUrl('PuttingRecordsPage')}
              className="w-full h-14 bg-slate-600 hover:bg-slate-700 rounded-xl"
            >
              <Trophy className="w-5 h-5 mr-2" />
              View Leaderboard
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

        {/* Mobile Leaderboard */}
        {showLeaderboard && (
          <MobileLeaderboard game={game} onClose={() => setShowLeaderboard(false)} />
        )}
      </div>
    );
  }

  // Scoring View
  const currentRound = Math.floor(playerPutts.length / format.puttsPerRound) + 1;
  const totalRounds = 20;

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
            <p className="text-sm text-slate-500">
              {format.name} • Round {currentRound} of {totalRounds}
            </p>
          </div>
          <button
            onClick={() => setShowLeaderboard(true)}
            className="text-emerald-600 hover:text-emerald-700"
          >
            <Trophy className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <ProgressBar putts={playerPutts} gameType={gameType} />

        {/* Your Stats */}
        <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 mb-4">
          <div className="flex items-center justify-around text-center">
            <div>
              <div className="text-xs text-slate-500">Points</div>
              <div className="text-2xl font-bold text-emerald-600">
                {game.total_points[playerName] || 0}
              </div>
            </div>
            <div className="h-10 w-px bg-slate-200" />
            <div>
              <div className="text-xs text-slate-500">Round</div>
              <div className="text-2xl font-bold text-slate-600">
                {currentRound}/{totalRounds}
              </div>
            </div>
          </div>
        </div>

        {/* Putt Type Selector */}
        <PuttTypeSelector selectedType={puttType} onSelect={setPuttType} />

        {/* Score Input */}
        {format.singlePuttMode ? (
          <BackAndForthInput
            player={playerName}
            currentDistance={currentDistance}
            onMade={() => handleBackAndForthPutt(true)}
            onMissed={() => handleBackAndForthPutt(false)}
            canUndo={canUndo}
            onUndo={handleUndo}
            showStreak={gameType === 'streak_challenge'}
            currentStreak={gameType === 'streak_challenge' ? playerPutts.filter((p, i) => {
              const streak = [];
              for (let j = playerPutts.length - 1; j >= 0; j--) {
                if (playerPutts[j].result === 'made') streak.push(playerPutts[j]);
                else break;
              }
              return streak.length;
            }).length : 0}
          />
        ) : (
          <ClassicScoreInput
            player={playerName}
            currentDistance={currentDistance}
            onSubmit={handleClassicSubmit}
            canUndo={canUndo}
            onUndo={handleUndo}
            distanceMap={format.distanceMap}
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