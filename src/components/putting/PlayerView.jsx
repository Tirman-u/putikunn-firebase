import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trophy, Upload, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { createPageUrl } from '@/utils';
import ClassicScoreInput from './ClassicScoreInput';
import BackAndForthInput from './BackAndForthInput';
import BackAndForthScoreInput from './BackAndForthScoreInput';
import StreakChallengeInput from './StreakChallengeInput';
import JylyScoreTable from './JylyScoreTable';
import ProgressBar from './ProgressBar';
import MobileLeaderboard from './MobileLeaderboard';
import PuttTypeSelector from './PuttTypeSelector';
import PerformanceAnalysis from './PerformanceAnalysis';
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
  const [streakDistanceSelected, setStreakDistanceSelected] = React.useState(false);
  const [hideScore, setHideScore] = React.useState(false);
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

      const leaderboardData = {
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
      };

      // Add distance for streak challenge
      if (game.game_type === 'streak_challenge') {
        leaderboardData.streak_distance = game.player_distances?.[playerName] || 0;
      }

      return await base44.entities.LeaderboardEntry.create(leaderboardData);
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
    const playerDist = game.player_distances || {};
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

    // Check if game is complete after this update
    const updatedPuttsLength = allPlayerPutts[playerName].length;
    const willBeComplete = isGameComplete(gameType, updatedPuttsLength);
    const isSoloGame = game.pin === '0000';

    updateGameMutation.mutate({
      id: game.id,
      data: {
        player_putts: allPlayerPutts,
        total_points: newTotalPoints,
        player_distances: newPlayerDistances,
        ...(willBeComplete && isSoloGame ? { status: 'completed' } : {})
      }
    });
  };

  // Handle Back & Forth / Streak / Random format (1 putt at a time)
  const handleBackAndForthPutt = (wasMade) => {
    const gameType = game.game_type || 'classic';
    const format = GAME_FORMATS[gameType];
    const playerDist = game.player_distances || {};
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

    const allPlayerPutts = { ...game.player_putts };
    if (!allPlayerPutts[playerName]) {
      allPlayerPutts[playerName] = [];
    }
    allPlayerPutts[playerName].push(newPutt);

    const newTotalPoints = { ...game.total_points };
    newTotalPoints[playerName] = (newTotalPoints[playerName] || 0) + points;

    // For Streak Challenge, handle streak tracking
    let nextDistance = currentDistance;
    let streakUpdate = {};

    if (gameType === 'streak_challenge') {
      const currentStreaks = game.player_current_streaks || {};
      const highestStreaks = game.player_highest_streaks || {};
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

    const newPlayerDistances = { ...game.player_distances };
    newPlayerDistances[playerName] = nextDistance;

    // Check if game is complete after this update (for back_and_forth)
    const updatedPuttsLength = allPlayerPutts[playerName].length;
    const willBeComplete = gameType !== 'streak_challenge' && isGameComplete(gameType, updatedPuttsLength);
    const isSoloGame = game.pin === '0000';

    updateGameMutation.mutate({
      id: game.id,
      data: {
        player_putts: allPlayerPutts,
        total_points: newTotalPoints,
        player_distances: newPlayerDistances,
        ...streakUpdate,
        ...(willBeComplete && isSoloGame ? { status: 'completed' } : {})
      }
    });
  };

  // Handle Streak Challenge distance selection
  const handleStreakDistanceSelect = (distance) => {
    const newPlayerDistances = { ...game.player_distances };
    newPlayerDistances[playerName] = distance;

    updateGameMutation.mutate({
      id: game.id,
      data: {
        player_distances: newPlayerDistances
      }
    });
    setStreakDistanceSelected(true);
  };

  // Handle Finish Training for Streak Challenge
  const handleFinishTraining = () => {
    updateGameMutation.mutate({
      id: game.id,
      data: {
        status: 'completed'
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

      // Recalculate distance - if there was a previous putt, check if it was made/missed
      let prevDistance = format.startDistance;
      if (newPutts.length > 0) {
        const prevPutt = newPutts[newPutts.length - 1];
        prevDistance = getNextDistanceBackAndForth(prevPutt.distance, prevPutt.result === 'made');
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
        // For random_distance mode, restore the actual previous distance instead of generating new
        if (gameType === 'random_distance') {
          prevDistance = prevRoundPutts[0].distance;
        } else {
          prevDistance = getNextDistanceFromMade(gameType, prevMade);
        }
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
  const playerDistances = game.player_distances || {};
  const currentDistance = playerDistances[playerName] || format.startDistance;
  const canUndo = playerPutts.length > 0;
  const currentStreaks = game.player_current_streaks || {};
  const currentStreak = currentStreaks[playerName] || 0;
  const isComplete = isGameComplete(gameType, playerPutts.length) || (gameType === 'streak_challenge' && game.status === 'completed');

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

            {/* Performance Analysis */}
            <PerformanceAnalysis playerPutts={playerPutts} />

            <div className="space-y-3 mt-6">
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
  const currentRound = gameType === 'streak_challenge' ? 1 : Math.floor(playerPutts.length / format.puttsPerRound) + 1;
  const totalRounds = gameType === 'streak_challenge' ? 1 : 20;

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
        {gameType !== 'streak_challenge' && gameType !== 'back_and_forth' && <ProgressBar putts={playerPutts} gameType={gameType} />}

        {/* Your Stats - Hidden for back_and_forth */}
        {gameType !== 'back_and_forth' && (
          <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 mb-4">
            <div className="flex items-center justify-around text-center">
              <div>
                <div className="text-xs text-slate-500">{gameType === 'streak_challenge' ? 'Best Streak' : 'Points'}</div>
                <div className="text-2xl font-bold text-emerald-600">
                  {hideScore ? '***' : (gameType === 'streak_challenge' ? (game.player_highest_streaks?.[playerName] || 0) : (game.total_points[playerName] || 0))}
                </div>
              </div>
              <div className="h-10 w-px bg-slate-200" />
              <div>
                <div className="text-xs text-slate-500">{gameType === 'streak_challenge' ? 'Putts' : 'Round'}</div>
                <div className="text-2xl font-bold text-slate-600">
                  {gameType === 'streak_challenge' ? playerPutts.length : `${currentRound}/${totalRounds}`}
                </div>
              </div>
              <div className="h-10 w-px bg-slate-200" />
              <button
                onClick={() => setHideScore(!hideScore)}
                className="flex flex-col items-center justify-center"
              >
                {hideScore ? (
                  <EyeOff className="w-5 h-5 text-slate-400" />
                ) : (
                  <Eye className="w-5 h-5 text-slate-400" />
                )}
                <div className="text-xs text-slate-400 mt-1">
                  {hideScore ? 'Show' : 'Hide'}
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Putt Type Display - Hidden for back_and_forth */}
        {gameType !== 'streak_challenge' && gameType !== 'back_and_forth' && (
          <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 mb-4">
            <div className="text-xs text-slate-500 mb-1">Putt Style</div>
            <div className="text-sm font-semibold text-slate-800">
              {game.putt_type === 'regular' ? 'Regular' : game.putt_type === 'straddle' ? 'Straddle' : 'Turbo'}
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
               totalPoints={game.total_points[playerName] || 0}
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