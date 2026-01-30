import React, { useState, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowUp, ArrowDown, Undo2, Trophy, Eye, EyeOff, LogOut, Target } from 'lucide-react';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';
import LoadingState from '@/components/ui/loading-state';
import useATWGameState from '@/hooks/use-atw-game-state';



export default function AroundTheWorldGameView({ gameId, playerName, isSolo }) {
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [hideScore, setHideScore] = useState(false);
  const {
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
  } = useATWGameState({ gameId, playerName, isSolo });

  const handleViewLeaderboard = useCallback(() => {
    setShowLeaderboard(true);
  }, []);

  const { currentDistance, totalScore, bestScore, difficultyLabel } = gameStats || {};

  if (isLoading || !game || !config) {
    return <LoadingState />;
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
          
          <ATWTournamentLeaderboard game={game} />
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
      difficultyLabel={difficultyLabel}
      config={config}
      isSolo={isSolo}
      handleCompleteGame={handleCompleteGame}
      handlePlayAgain={handlePlayAgain}
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
      difficultyLabel={difficultyLabel}
      config={config}
      isSolo={isSolo}
      hideScore={hideScore}
      setHideScore={setHideScore}
      handleSubmitPutts={handleSubmitPutts}
      handleUndo={handleUndo}
      undoMutation={undoMutation}
      onViewLeaderboard={handleViewLeaderboard}
      onExit={handleExit}
    />
  );
}

        // Memoized completed game view
        const CompletedGameView = React.memo(({ 
        game, playerState, playerName, totalScore, bestScore, difficultyLabel, 
        config, isSolo, handleCompleteGame,
        handlePlayAgain,
        gameId, submitToLeaderboardMutation, user 
        }) => {
        const attemptsCount = playerState.attempts_count || 0;
        const failedTurns = useMemo(() => 
        playerState.history.filter(turn => turn.failed_to_advance || turn.missed_all),
        [playerState.history]
        );

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
              <div className="text-4xl font-bold text-purple-600 mb-2">{attemptsCount}</div>
              <div className="text-sm text-slate-600">Attempts</div>
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
  game, playerState, playerName, currentDistance, totalScore, bestScore, 
  difficultyLabel, config, isSolo, hideScore, setHideScore, handleSubmitPutts, 
  handleUndo, undoMutation,
  onViewLeaderboard, onExit 
}) => {
  const discsPerTurn = config.discs_per_turn || 1;
  const attemptsCount = playerState.attempts_count || 0;
  const usePerDiscInput = discsPerTurn >= 3;
  const [shotResults, setShotResults] = React.useState(
    Array.from({ length: discsPerTurn }, () => null)
  );

  React.useEffect(() => {
    setShotResults(Array.from({ length: discsPerTurn }, () => null));
  }, [playerState.turns_played, currentDistance, discsPerTurn]);

  const handleShot = (isMake) => {
    const nextIndex = shotResults.findIndex((result) => result === null);
    if (nextIndex === -1) return;

    const nextResults = [...shotResults];
    nextResults[nextIndex] = isMake;
    setShotResults(nextResults);

    if (nextIndex === discsPerTurn - 1) {
      const madeCount = nextResults.filter(Boolean).length;
      handleSubmitPutts(madeCount);
      setShotResults(Array.from({ length: discsPerTurn }, () => null));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <div className="max-w-md mx-auto px-4 pt-8">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onExit}
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
            <div className="text-xl font-bold text-purple-600">{attemptsCount}</div>
            <div className="text-xs text-slate-600">Attempts</div>
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
            <div className="flex flex-wrap items-center justify-center gap-3 mb-3">
              <div className="inline-flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-full">
                <span className="text-xs sm:text-sm font-semibold text-slate-700 whitespace-nowrap">
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
            {usePerDiscInput ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {shotResults.map((result, idx) => (
                    <span
                      key={idx}
                      className={`h-3 w-12 rounded-full transition-all ${
                        result === true
                          ? 'bg-emerald-500'
                          : result === false
                          ? 'bg-red-400'
                          : 'bg-slate-200'
                      }`}
                    />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleShot(false)}
                    className="h-14 rounded-xl font-bold text-base bg-red-100 text-red-700 hover:bg-red-200 active:scale-95 transition-all"
                  >
                    Miss
                  </button>
                  <button
                    onClick={() => handleShot(true)}
                    className="h-14 rounded-xl font-bold text-base bg-emerald-100 text-emerald-700 hover:bg-emerald-200 active:scale-95 transition-all"
                  >
                    Make
                  </button>
                </div>
              </div>
            ) : (
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
            )}
            {playerState.history && playerState.history.length > 0 && (
              <button
                onClick={handleUndo}
                disabled={undoMutation.isPending}
                className="w-full h-16 rounded-xl font-bold text-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all disabled:opacity-50 mt-3"
              >
                <Undo2 className="w-4 h-4 mr-2 inline" />
                Võta tagasi
              </button>
            )}
            <div className="grid grid-cols-2 gap-3 mt-3">
              <button
                onClick={onViewLeaderboard}
                className="h-12 rounded-xl font-semibold text-sm bg-white border border-slate-200 text-slate-700 hover:border-emerald-300 hover:text-emerald-700 transition-all"
              >
                <Trophy className="w-4 h-4 mr-2 inline" />
                Edetabel
              </button>
              <button
                onClick={onExit}
                className="h-12 rounded-xl font-semibold text-sm bg-white border border-red-200 text-red-600 hover:border-red-300 hover:bg-red-50 transition-all"
              >
                <LogOut className="w-4 h-4 mr-2 inline" />
                Välju
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

const ATWTournamentLeaderboard = React.memo(({ game }) => {
  const playerNames = (game.players && game.players.length > 0)
    ? game.players
    : Object.keys(game.atw_state || {});

  const playerStats = playerNames.map(playerName => {
    const playerState = game.atw_state?.[playerName] || {};
    const currentScore = game.total_points?.[playerName] || 0;
    const bestScore = playerState.best_score || 0;
    const currentLaps = playerState.laps_completed || 0;
    const bestLaps = playerState.best_laps || 0;
    const attemptsCount = playerState.attempts_count || 0;

    return {
      name: playerName,
      currentScore,
      bestScore,
      currentLaps,
      bestLaps,
      attemptsCount
    };
  }).sort((a, b) => b.bestScore - a.bestScore);

  const bestPlayer = playerStats[0];
  const mostAttempts = Math.max(...playerStats.map(p => p.attemptsCount || 0), 0);
  const mostAttemptsPlayer = playerStats.find(p => p.attemptsCount === mostAttempts);
  const isCompleted = game.status === 'completed';

  return (
    <div className="space-y-6">
      {game.pin && game.pin !== '0000' && (
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 shadow-lg text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold mb-1 opacity-90">Game PIN</div>
              <div className="text-3xl font-bold tracking-widest">{game.pin}</div>
            </div>
            <div className="text-sm opacity-90">
              {playerNames.length} players
            </div>
          </div>
        </div>
      )}

      {bestPlayer && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              <div className="text-sm text-slate-600">Best Score</div>
            </div>
            <div className="text-3xl font-bold text-emerald-600">{bestPlayer.bestScore}</div>
            <div className="text-xs text-slate-500 mt-1">{bestPlayer.name}</div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm text-center">
            <div className="text-sm text-slate-600 mb-2">Most Laps</div>
            <div className="text-3xl font-bold text-blue-600">{bestPlayer.bestLaps}</div>
            <div className="text-xs text-slate-500 mt-1">{bestPlayer.name}</div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Target className="w-5 h-5 text-purple-500" />
              <div className="text-sm text-slate-600">Attempts</div>
            </div>
            <div className="text-3xl font-bold text-purple-600">{mostAttempts}</div>
            <div className="text-xs text-slate-500 mt-1">{mostAttemptsPlayer?.name}</div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left p-4 font-semibold text-slate-700">#</th>
                <th className="text-left p-4 font-semibold text-slate-700">Player</th>
                <th className="text-center p-4 font-semibold text-slate-700">Best Score</th>
                <th className="text-center p-4 font-semibold text-slate-700">Current</th>
                <th className="text-center p-4 font-semibold text-slate-700">Laps</th>
                <th className="text-center p-4 font-semibold text-slate-700">Attempts</th>
              </tr>
            </thead>
            <tbody>
              {playerStats.map((player, index) => (
                <tr key={player.name} className={`border-b border-slate-100 ${index === 0 && isCompleted ? 'bg-amber-50' : ''}`}>
                  <td className="p-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      index === 0 ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {index + 1}
                    </div>
                  </td>
                  <td className="p-4 font-medium text-slate-800">{player.name}</td>
                  <td className="p-4 text-center">
                    <div className="text-lg font-bold text-emerald-600">{player.bestScore}</div>
                  </td>
                  <td className="p-4 text-center">
                    <div className="text-sm text-slate-500">{player.currentScore}</div>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex flex-col items-center">
                      <div className="text-sm font-bold text-blue-600">{player.bestLaps}</div>
                      <div className="text-xs text-slate-400">{player.currentLaps}</div>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <div className="text-sm font-bold text-purple-600">{player.attemptsCount}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});
