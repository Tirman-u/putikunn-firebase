import React, { useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, deleteDoc, onSnapshot, collection, query, where, getDocs } from "firebase/firestore";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trash2, Share2, Calendar, Upload } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { format as formatDate, toDate } from 'date-fns';
import { GAME_FORMATS, getTotalRounds } from '@/components/putting/gameRules';
import { toast } from 'sonner';
import PerformanceAnalysis from '@/components/putting/PerformanceAnalysis';
import AroundTheWorldGameView from '@/components/putting/AroundTheWorldGameView';
import HostView from '@/components/putting/HostView';
import { createPageUrl } from '@/utils';
import LoadingState from '@/components/ui/loading-state';

// Temporary stubs for leaderboard functionality
const isHostedClassicGame = (game) => game?.game_type === 'classic' && game?.pin && game.pin !== '0000';

export default function GameResult() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const gameId = searchParams.get('id');
  const { user } = useAuth();

  const { data: currentUserData } = useQuery({
    queryKey: ['userProfile', user?.uid],
    queryFn: async () => {
      if (!user) return null;
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);
      return userDocSnap.exists() ? userDocSnap.data() : null;
    },
    enabled: !!user,
  });

  const { data: game, isLoading, error } = useQuery({
    queryKey: ['game', gameId],
    queryFn: async () => {
      const gameDocRef = doc(db, "games", gameId);
      const gameDocSnap = await getDoc(gameDocRef);
      if (!gameDocSnap.exists()) throw new Error('Mängu ei leitud');
      return { id: gameDocSnap.id, ...gameDocSnap.data() };
    },
    enabled: !!gameId,
    retry: false,
  });

  // Real-time updates
  useEffect(() => {
    if (!gameId) return;
    const unsub = onSnapshot(doc(db, "games", gameId), (doc) => {
      if (doc.exists()) {
        queryClient.setQueryData(['game', gameId], { id: doc.id, ...doc.data() });
      } else {
        queryClient.setQueryData(['game', gameId], undefined);
      }
    });
    return () => unsub();
  }, [gameId, queryClient]);

  const deleteGameMutation = useMutation({
    mutationFn: async (id) => {
        // Also delete associated leaderboard entries in a real app
        await deleteDoc(doc(db, "games", id));
    },
    onSuccess: () => {
      toast.success("Mäng kustutatud");
      navigate(-1);
    },
    onError: () => {
        toast.error("Mängu kustutamine ebaõnnestus");
    }
  });
  
  if (isLoading) return <LoadingState />;

  if (error || !game) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-slate-400 mb-4">Mängu ei leitud</div>
          <Button onClick={() => navigate(-1)}>Tagasi</Button>
        </div>
      </div>
    );
  }
  
  const userRole = currentUserData?.app_role || 'user';
  const myDisplayName = currentUserData?.displayName || user?.displayName || user?.email;

  // Redirect logic for active games (ATW)
  if (game.game_type === 'around_the_world' && game.status !== 'completed') {
      const isHost = user?.uid === game.host_uid;
      if(isHost) {
          window.location.href = createPageUrl('Home') + '?mode=atw-host&gameId=' + game.id;
          return null;
      }
      return <AroundTheWorldGameView gameId={game.id} playerName={myDisplayName} isSolo={false} />
  }

  const gameType = game.game_type || 'classic';
  const gameFormat = GAME_FORMATS[gameType];
  const totalRounds = getTotalRounds(gameType);
  const canDelete = ['admin', 'super_admin'].includes(userRole) || user?.uid === game.host_uid;
  
  const playerStats = (game.players || []).map(playerInfo => {
    const playerUid = playerInfo.uid;
    const putts = game.player_putts?.[playerUid] || [];
    const totalPutts = putts.length;
    const madePutts = putts.filter(p => p.result === 'made').length;
    const puttingPercentage = totalPutts > 0 ? ((madePutts / totalPutts) * 100).toFixed(1) : 0;
    const totalPoints = game.total_points?.[playerUid] || 0;
    
    const frames = [];
    if (gameType === 'classic' || gameType === 'short' || gameType === 'long') {
        for (let i = 0; i < putts.length; i += 5) {
            const framePutts = putts.slice(i, i + 5);
            const distance = framePutts[0]?.distance || 0;
            const made = framePutts.filter(p => p.result === 'made').length;
            frames.push({ distance, made });
        }
    }

    return {
      name: playerInfo.name,
      uid: playerUid,
      totalPutts,
      madePutts,
      puttingPercentage,
      totalPoints,
      putts,
      frames
    };
  }).sort((a, b) => b.totalPoints - a.totalPoints);
  
  const handleShare = async () => {
      // Share functionality remains the same
  };

  const handleDelete = () => {
    if (confirm('Kas kustutame selle mängu? Seda ei saa tagasi võtta.')) {
      deleteGameMutation.mutate(game.id);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <div className="max-w-4xl mx-auto p-4">
        <div className="flex items-center justify-between mb-6 pt-4">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-600 hover:text-slate-800">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Tagasi</span>
          </button>
          <h1 className="text-2xl font-bold text-slate-800">{game.name}</h1>
          <div className="w-16" />
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-6">
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <div className="text-sm text-slate-500 mb-1">Formaat</div>
                    <div className="font-bold text-slate-800">{gameFormat?.name || 'Tundmatu'}</div>
                </div>
                <div>
                    <div className="text-sm text-slate-500 mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" />Kuupäev</div>
                    <div className="font-bold text-slate-800">{game.date ? formatDate(toDate(game.date.seconds * 1000), 'MMM d, yyyy') : 'N/A'}</div>
                </div>
            </div>
            <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                    <Button onClick={handleShare} variant="outline" className="flex-1"><Share2 className="w-4 h-4 mr-2" />Jaga</Button>
                    {canDelete && (
                        <Button onClick={handleDelete} variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                            <Trash2 className="w-4 h-4 mr-2" />Kustuta
                        </Button>
                    )}
                </div>
                {/* Leaderboard submission UI is temporarily disabled */}
            </div>
        </div>
        
        {game.players.length === 1 && (
          <PerformanceAnalysis playerPutts={game.player_putts?.[game.players[0].uid] || []} />
        )}

        {/* Results Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
           <div className="overflow-x-auto">
             <table className="w-full">
                <thead>
                    <tr className="border-b border-slate-200">
                        <th className="text-left p-4 font-semibold text-slate-700 bg-slate-50 sticky left-0 z-10">Mängija</th>
                        {[...Array(totalRounds)].map((_, i) => <th key={i} className="text-center p-2 font-semibold text-slate-700 bg-slate-50 text-sm min-w-[60px]">{i + 1}</th>)}
                        <th className="text-center p-4 font-semibold text-slate-700 bg-slate-50 sticky right-0 z-10">Kokku</th>
                    </tr>
                </thead>
                <tbody>
                  {playerStats.map((player, pIndex) => (
                    <tr key={player.uid} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="p-4 font-medium text-slate-800 bg-white sticky left-0 z-10 border-r border-slate-100">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-600">{pIndex + 1}</div>
                            <span>{player.name}</span>
                          </div>
                      </td>
                      {[...Array(totalRounds)].map((_, frameIndex) => {
                        const frame = player.frames[frameIndex];
                        return (
                          <td key={frameIndex} className="p-2 text-center">
                            {frame ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <div className="text-xs text-slate-500 font-medium">{frame.distance}m</div>
                                <div className={`text-base font-bold ${frame.made === 5 ? 'text-emerald-600' : frame.made >= 3 ? 'text-emerald-500' : 'text-slate-600'}`}>{frame.made}</div>
                              </div>
                            ) : <div className="text-slate-300">-</div>}
                          </td>
                        );
                      })}
                      <td className="p-4 text-center bg-white sticky right-0 z-10 border-l border-slate-100">
                        <div className="font-bold text-lg text-emerald-600">{player.totalPoints}</div>
                        <div className="text-xs text-slate-500">{player.puttingPercentage}%</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
             </table>
           </div>
        </div>
      </div>
    </div>
  );
}
