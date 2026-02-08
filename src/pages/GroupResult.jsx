import React from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Trophy, Calendar } from 'lucide-react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format, toDate } from 'date-fns';
import { GAME_FORMATS } from '@/components/putting/gameRules';
import LoadingState from '@/components/ui/loading-state';

export default function GroupResult() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const groupId = searchParams.get('id');

  const { data: group, isLoading: groupLoading } = useQuery({
    queryKey: ['group', groupId],
    queryFn: async () => {
      const groupDocRef = doc(db, "game_groups", groupId);
      const groupDocSnap = await getDoc(groupDocRef);
      return groupDocSnap.exists() ? { id: groupDocSnap.id, ...groupDocSnap.data() } : null;
    },
    enabled: !!groupId
  });

  const { data: games = [], isLoading: gamesLoading } = useQuery({
    queryKey: ['group-games', groupId],
    queryFn: async () => {
      if (!group?.game_ids || group.game_ids.length === 0) return [];
      const gamesRef = collection(db, "games");
      // Firestore 'in' query is limited to 10 elements. If a group can have more, this needs batching.
      const q = query(gamesRef, where('__name__', 'in', group.game_ids.slice(0, 10)));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    enabled: !!group
  });

  if (groupLoading || gamesLoading || !group) {
    return <LoadingState />;
  }

  const playerScores = {};
  const playerGamesCount = {};
  let totalPuttsOverall = 0;
  let madePuttsOverall = 0;
  const allGameBestScores = [];

  games.forEach(game => {
    const gameBestScore = Object.values(game.total_points || {}).length > 0
      ? Math.max(...Object.values(game.total_points || {}))
      : 0;
    allGameBestScores.push(gameBestScore);
    
    (game.players || []).forEach(playerInfo => {
        const playerName = playerInfo.name;
        const playerUid = playerInfo.uid;
        const points = game.total_points?.[playerUid] || 0;
        const putts = game.player_putts?.[playerUid] || [];
      
        if (!playerScores[playerName]) {
            playerScores[playerName] = 0;
            playerGamesCount[playerName] = 0;
        }
      
        playerScores[playerName] += points;
        playerGamesCount[playerName] += 1;
        totalPuttsOverall += putts.length;
        madePuttsOverall += putts.filter(p => p.result === 'made').length;
    });
  });

  const avgPuttingPercentage = totalPuttsOverall > 0 ? ((madePuttsOverall / totalPuttsOverall) * 100).toFixed(1) : 0;
  const bestScore = allGameBestScores.length > 0 ? Math.max(...allGameBestScores) : 0;
  const avgScore = allGameBestScores.length > 0 ? Math.round(allGameBestScores.reduce((sum, s) => sum + s, 0) / allGameBestScores.length) : 0;

  const playerRanking = Object.entries(playerScores)
    .map(([name, score]) => ({
      name,
      totalPoints: score,
      gamesPlayed: playerGamesCount[name]
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints);

  const gamesWithStats = games.map(game => {
    const gameType = game.game_type || 'classic';
    const formatInfo = GAME_FORMATS[gameType];
    
    let totalPutts = 0;
    let madePutts = 0;
    (game.players || []).forEach(pInfo => {
      const putts = game.player_putts?.[pInfo.uid] || [];
      totalPutts += putts.length;
      madePutts += putts.filter(p => p.result === 'made').length;
    });
    
    const puttingPercentage = totalPutts > 0 ? ((madePutts / totalPutts) * 100).toFixed(1) : 0;
    const bestGameScore = Object.values(game.total_points || {}).length > 0 
      ? Math.max(...Object.values(game.total_points || {})) 
      : 0;

    return {
      ...game,
      formatName: formatInfo?.name || 'Tundmatu',
      puttingPercentage,
      bestScore: bestGameScore
    };
  }).sort((a, b) => toDate(b.date?.seconds * 1000 || 0).getTime() - toDate(a.date?.seconds * 1000 || 0).getTime());

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <div className="max-w-6xl mx-auto p-4">
        <div className="flex items-center justify-between mb-6 pt-4">
            <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-600 hover:text-slate-800">
                <ArrowLeft className="w-5 h-5" /><span className="font-medium">Tagasi</span>
            </button>
            <h1 className="text-2xl font-bold text-slate-800">{group.name}</h1>
            <div className="w-16" />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100"> {/* ... summary stats ... */} </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 mb-3">Mängud grupis</h2>
              {gamesWithStats.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center text-slate-400">Grupi mänge pole</div>
              ) : (
                <div className="space-y-3">
                  {gamesWithStats.map(game => (
                    <Link key={game.id} to={`${createPageUrl('GameResult')}?id=${game.id}`} className="block bg-white rounded-xl p-4 shadow-sm border border-slate-100 hover:border-emerald-300 hover:shadow-md transition-all">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-slate-800">{game.name}</span>
                            <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded">{game.formatName}</span>
                          </div>
                          <div className="text-sm text-slate-500 flex items-center gap-2">
                            <Calendar className="w-3 h-3" />
                            {game.date ? format(toDate(game.date.seconds * 1000), 'MMM d, yyyy') : 'N/A'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-emerald-600">{game.bestScore}</div>
                          <div className="text-xs text-slate-500">{game.puttingPercentage}% sees</div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="lg:col-span-1">
             <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 sticky top-4">
                <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Trophy className="w-5 h-5 text-amber-500" />Grupi edetabel</h2>
                {playerRanking.length === 0 ? (
                    <div className="text-center text-slate-400 py-8">Mängijaid veel pole</div>
                ) : (
                    <div className="space-y-2">
                        {playerRanking.map((player, index) => (
                            <div key={player.name} className={`p-3 rounded-xl transition-all ${index === 0 ? 'bg-gradient-to-r from-amber-50 to-amber-100 border-2 border-amber-200' : 'bg-slate-50'}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${index === 0 ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-600'}`}>{index + 1}</div>
                                    <div className="flex-1">
                                        <div className="font-bold text-slate-800">{player.name}</div>
                                        <div className="text-xs text-slate-500">{player.gamesPlayed} mängu</div>
                                    </div>
                                    <div className="text-right">
                                        <div className={`text-xl font-bold ${index === 0 ? 'text-amber-600' : 'text-slate-700'}`}>{player.totalPoints}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
