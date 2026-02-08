import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trophy, Upload, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, setDoc, query, collection, where, getDocs, onSnapshot, arrayUnion } from 'firebase/firestore';
import ClassicScoreInput from './ClassicScoreInput';
import BackAndForthScoreInput from './BackAndForthScoreInput';
import StreakChallengeInput from './StreakChallengeInput';
import MobileLeaderboard from './MobileLeaderboard';
import PerformanceAnalysis from './PerformanceAnalysis';
import { createPageUrl } from '@/utils';
import LoadingState from '@/components/ui/loading-state';
import usePlayerGameState from '@/hooks/use-player-game-state';
import { resolveLeaderboardPlayer } from '@/lib/leaderboard-utils';
import { GAME_FORMATS, getNextDistanceFromMade, getNextDistanceBackAndForth, calculateRoundScore, getTotalRounds, isGameComplete } from './gameRules';

export default function PlayerView({ gameId, playerName, onExit }) {
    const [showLeaderboard, setShowLeaderboard] = useState(false);
    const [hideScore, setHideScore] = useState(false);
    const [localGameState, setLocalGameState] = useState(null);
    const queryClient = useQueryClient();
    const { user, game: initialGame, isLoading, isSoloGame } = usePlayerGameState({ gameId });

    useEffect(() => {
        if (!gameId) return;
        const unsub = onSnapshot(doc(db, "games", gameId), (doc) => {
            if (doc.exists()) {
                const gameData = { id: doc.id, ...doc.data() };
                queryClient.setQueryData(['game', gameId], gameData);
                if (isSoloGame) {
                    setLocalGameState(gameData);
                }
            }
        });
        return () => unsub();
    }, [gameId, queryClient, isSoloGame]);

    const game = isSoloGame ? localGameState : queryClient.getQueryData(['game', gameId]) || initialGame;

    const updateGameState = useCallback(async (data) => {
        if (!gameId) return;
        if (isSoloGame) {
            setLocalGameState(prev => ({...prev, ...data}));
        } else {
            const gameRef = doc(db, "games", gameId);
            await updateDoc(gameRef, data);
        }
    }, [gameId, isSoloGame]);

    const saveSoloGameMutation = useMutation({
        mutationFn: async (data) => {
            const gameRef = doc(db, "games", gameId);
            return updateDoc(gameRef, data);
        },
        onSuccess: () => {
            toast.success('Mäng salvestatud!');
            queryClient.invalidateQueries({ queryKey: ['game', gameId] });
        }
    });

    const submitToLeaderboardMutation = useMutation({
        mutationFn: async () => {
            if (!game) return;
            const playerPutts = game.player_putts?.[playerName] || [];
            const madePutts = playerPutts.filter(p => p.result === 'made').length;
            const totalPutts = playerPutts.length;
            const accuracy = totalPutts > 0 ? (madePutts / totalPutts) * 100 : 0;

            const leaderboardData = {
                game_id: game.id,
                player_name: playerName,
                game_type: game.game_type,
                score: game.total_points[playerName] || 0,
                accuracy: Math.round(accuracy * 10) / 10,
                made_putts: madePutts,
                total_putts: totalPutts,
                leaderboard_type: 'general',
                date: new Date().toISOString()
            };
            
            const q = query(collection(db, "leaderboard"), where("game_id", "==", game.id), where("player_name", "==", playerName));
            const existing = await getDocs(q);

            if (!existing.empty) {
                const docRef = existing.docs[0].ref;
                if(leaderboardData.score > existing.docs[0].data().score) {
                    await updateDoc(docRef, leaderboardData);
                }
            } else {
                await setDoc(doc(collection(db, "leaderboard")), leaderboardData);
            }
        },
        onSuccess: () => {
            toast.success('Tulemus edetabelisse saadetud!');
        }
    });

    const handleClassicSubmit = (madeCount) => {
        const { game_type = 'classic', player_distances = {}, player_putts = {}, total_points = {} } = game;
        const currentDistance = player_distances[playerName] || GAME_FORMATS[game_type].startDistance;
        let newPutts = [];
        for (let i = 0; i < 5; i++) newPutts.push({ distance: currentDistance, result: i < madeCount ? 'made' : 'missed', timestamp: new Date().toISOString() });
        const roundScore = calculateRoundScore(currentDistance, madeCount);
        const nextDistance = getNextDistanceFromMade(game_type, madeCount);

        const updatedData = {
            player_putts: { ...player_putts, [playerName]: [...(player_putts[playerName] || []), ...newPutts] },
            total_points: { ...total_points, [playerName]: (total_points[playerName] || 0) + roundScore },
            player_distances: { ...player_distances, [playerName]: nextDistance },
        };

        if (isSoloGame && isGameComplete(game_type, (player_putts[playerName] || []).length + 5)) {
            saveSoloGameMutation.mutate({...updatedData, status: 'completed'});
        } else {
            updateGameState(updatedData);
        }
    };

    const handleBackAndForthPutt = (wasMade) => {
        const { game_type = 'classic', player_distances = {}, player_putts = {}, total_points = {} } = game;
        const currentDistance = player_distances[playerName] || GAME_FORMATS[game_type].startDistance;
        const newPutt = { distance: currentDistance, result: wasMade ? 'made' : 'missed', points: wasMade ? currentDistance : 0, timestamp: new Date().toISOString() };
        const nextDistance = getNextDistanceBackAndForth(currentDistance, wasMade);

        const updatedData = {
            player_putts: { ...player_putts, [playerName]: [...(player_putts[playerName] || []), newPutt] },
            total_points: { ...total_points, [playerName]: (total_points[playerName] || 0) + newPutt.points },
            player_distances: { ...player_distances, [playerName]: nextDistance },
        };
        
        if (isSoloGame && isGameComplete(game_type, (player_putts[playerName] || []).length + 1)) {
            saveSoloGameMutation.mutate({...updatedData, status: 'completed'});
        } else {
            updateGameState(updatedData);
        }
    };

    const handleUndo = () => {
      // This is a simplified undo. A more robust solution would be needed for complex game states.
      const { player_putts = {} } = game;
      const putts = player_putts[playerName] || [];
      if(putts.length > 0) {
        const newPutts = putts.slice(0, -1);
        updateGameState({player_putts: {...player_putts, [playerName]: newPutts}});
      }
    }

    if (isLoading || !game) return <LoadingState />;

    const gameType = game.game_type || 'classic';
    const format = GAME_FORMATS[gameType] || GAME_FORMATS.classic;
    const playerPutts = game.player_putts?.[playerName] || [];
    const isComplete = game.status === 'completed' || isGameComplete(gameType, playerPutts.length);
    const currentScore = game.total_points?.[playerName] || 0;
    const currentDistance = game.player_distances?.[playerName] || format.startDistance;
    const currentRound = Math.floor(playerPutts.length / format.puttsPerRound) + 1;
    const totalRounds = getTotalRounds(gameType);

    if (isComplete) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
              <div className="max-w-lg mx-auto p-4 pt-16">
                  <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center mb-8">
                      <div className="w-32 h-32 bg-gradient-to-br from-amber-400 to-amber-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-amber-300">
                          <Trophy className="w-16 h-16 text-white" />
                      </div>
                      <h1 className="text-4xl font-bold text-slate-800 mb-4">🎉 Lõpetatud!</h1>
                      <p className="text-xl text-slate-600 mb-2">Lõpetasid kõik ringid</p>
                      <p className="text-4xl font-bold text-emerald-600">{currentScore} punkti</p>
                  </motion.div>
                  <PerformanceAnalysis playerPutts={playerPutts} />
                  <div className="space-y-3 mt-6">
                      <Button onClick={() => submitToLeaderboardMutation.mutate()} disabled={submitToLeaderboardMutation.isPending} className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 rounded-xl"><Upload className="w-5 h-5 mr-2" />Saada edetabelisse</Button>
                      <Button onClick={() => setShowLeaderboard(true)} className="w-full h-14 bg-slate-600 hover:bg-slate-700 rounded-xl"><Trophy className="w-5 h-5 mr-2" />Vaata edetabelit</Button>
                      <Button onClick={onExit} variant="outline" className="w-full h-14 rounded-xl">Välju mängust</Button>
                  </div>
                  {showLeaderboard && <MobileLeaderboard game={game} onClose={() => setShowLeaderboard(false)} />}
              </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
            <div className="max-w-lg mx-auto p-4">
                <div className="flex items-center justify-between mb-4 pt-4">
                    <button onClick={onExit} className="text-slate-600 hover:text-slate-800"><ArrowLeft className="w-5 h-5" /></button>
                    <div className="text-center">
                        <h2 className="text-lg font-bold text-slate-800">{game.name}</h2>
                        <p className="text-sm text-slate-500">{format.name} • Ring {currentRound}/{totalRounds}</p>
                    </div>
                    <button onClick={() => setShowLeaderboard(true)} className="text-emerald-600 hover:text-emerald-700"><Trophy className="w-5 h-5" /></button>
                </div>

                <div className="bg-white rounded-xl p-2 sm:p-3 shadow-sm border border-slate-100 mb-3 sm:mb-4">
                    <div className="flex items-center justify-around text-center">
                        <div>
                            <div className="text-[11px] sm:text-xs text-slate-500">Punktid</div>
                            <div className="text-xl sm:text-2xl font-bold text-emerald-600">{hideScore ? '***' : currentScore}</div>
                        </div>
                        <div className="h-8 sm:h-10 w-px bg-slate-200" />
                        <div>
                            <div className="text-[11px] sm:text-xs text-slate-500">Ring</div>
                            <div className="text-xl sm:text-2xl font-bold text-slate-600">{currentRound}/{totalRounds}</div>
                        </div>
                        <div className="h-8 sm:h-10 w-px bg-slate-200" />
                        <button onClick={() => setHideScore(!hideScore)} className="flex flex-col items-center justify-center">
                            {hideScore ? <EyeOff className="w-5 h-5 text-slate-400" /> : <Eye className="w-5 h-5 text-slate-400" />}
                            <div className="text-[11px] sm:text-xs text-slate-400 mt-1">{hideScore ? 'Näita' : 'Peida'}</div>
                        </button>
                    </div>
                </div>

                {gameType === 'streak_challenge' ? (
                    <StreakChallengeInput player={playerName} currentDistance={currentDistance} onMade={() => handleBackAndForthPutt(true)} onMissed={() => handleBackAndForthPutt(false)} canUndo={playerPutts.length > 0} onUndo={handleUndo} currentStreak={game.player_current_streaks?.[playerName] || 0} showDistanceSelector={playerPutts.length === 0} onDistanceSelect={(d) => updateGameState({player_distances: {...game.player_distances, [playerName]: d}})} onFinishTraining={() => updateGameState({status: 'completed'})} />
                ) : format.singlePuttMode ? (
                    <BackAndForthScoreInput player={playerName} currentDistance={currentDistance} onMade={() => handleBackAndForthPutt(true)} onMissed={() => handleBackAndForthPutt(false)} canUndo={playerPutts.length > 0} onUndo={handleUndo} putts={playerPutts} puttType={game.putt_type || 'regular'} totalPoints={currentScore} hideScore={hideScore} />
                ) : (
                    <ClassicScoreInput player={playerName} currentDistance={currentDistance} onSubmit={handleClassicSubmit} canUndo={playerPutts.length > 0} onUndo={handleUndo} distanceMap={format.distanceMap || {}} currentRoundPutts={playerPutts} puttType={game.putt_type || 'regular'} totalFrames={totalRounds} />
                )}
            </div>
            {showLeaderboard && <MobileLeaderboard game={game} onClose={() => setShowLeaderboard(false)} />}
        </div>
    );
}
