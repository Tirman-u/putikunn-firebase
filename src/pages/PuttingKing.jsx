import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Plus, Trophy, Settings, ArrowLeft, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';

export default function PuttingKing() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: tournaments = [] } = useQuery({
    queryKey: ['putting-king-tournaments'],
    queryFn: async () => {
      return await base44.entities.PuttingKingTournament.list();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (tournamentId) => base44.entities.PuttingKingTournament.delete(tournamentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['putting-king-tournaments'] });
    }
  });

  const myTournaments = tournaments.filter(t => t.host_user === user?.email);
  const activeTournaments = tournaments.filter(t => t.status === 'active' && t.current_round < t.total_rounds && t.host_user !== user?.email);

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white p-4">
      <div className="max-w-4xl mx-auto pt-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-800 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Back</span>
        </button>

        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Trophy className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-slate-800 mb-2">Putting King!</h1>
          <p className="text-slate-600">2v2 Tournament Battles</p>
        </div>

        {/* Create Tournament */}
        <div className="mb-6">
          <Button
            onClick={() => navigate(createPageUrl('PuttingKingSetup'))}
            className="w-full h-16 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-lg font-bold rounded-2xl"
          >
            <Plus className="w-6 h-6 mr-2" />
            Create New Tournament
          </Button>
        </div>

        {/* Active Tournaments */}
        {activeTournaments.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-800 mb-3">Live Tournaments</h2>
            <div className="space-y-3">
              {activeTournaments.map(tournament => (
                <Link
                  key={tournament.id}
                  to={`${createPageUrl('PuttingKingOverview')}?id=${tournament.id}`}
                  className="block bg-white rounded-2xl p-5 shadow-sm border-2 border-purple-200 hover:border-purple-400 hover:shadow-lg transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-lg text-slate-800">{tournament.name}</div>
                      <div className="text-sm text-slate-500">
                        Target: {tournament.target_score} • Started {format(new Date(tournament.created_date), 'MMM d')}
                      </div>
                    </div>
                    <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                      Live
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* My Tournaments */}
        {myTournaments.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-slate-800 mb-3">My Tournaments</h2>
            <div className="space-y-3">
              {myTournaments.map(tournament => {
               const isTournamentFinished = tournament.current_round === tournament.total_rounds;
               const displayStatus = isTournamentFinished ? 'finished' : tournament.status;
               return (
               <div key={tournament.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                 <div className="flex items-center justify-between mb-3">
                   <div>
                     <div className="font-bold text-lg text-slate-800">{tournament.name}</div>
                     <div className="text-sm text-slate-500">
                       Status: {displayStatus} • Created {format(new Date(tournament.created_date), 'MMM d')}
                     </div>
                   </div>
                 </div>
                 <div className="flex gap-2">
                   <Link
                     to={`${createPageUrl('PuttingKingOverview')}?id=${tournament.id}`}
                     className="flex-1"
                   >
                     <Button variant="outline" className="w-full">
                       <Trophy className="w-4 h-4 mr-2" />
                       View
                     </Button>
                   </Link>
                   <Link
                     to={`${createPageUrl('PuttingKingSetup')}?id=${tournament.id}`}
                     className="flex-1"
                   >
                     <Button variant="outline" className="w-full">
                       <Settings className="w-4 h-4 mr-2" />
                       Manage
                     </Button>
                   </Link>
                   <Button
                     onClick={() => {
                       if (confirm(`Delete "${tournament.name}"? This action cannot be undone.`)) {
                         deleteMutation.mutate(tournament.id);
                       }
                     }}
                     variant="outline"
                     className="w-12 text-red-600 hover:text-red-700 hover:bg-red-50"
                   >
                     <Trash2 className="w-4 h-4" />
                   </Button>
                   </div>
                   </div>
                   );
                   })}
            </div>
          </div>
        )}

        {tournaments.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <Trophy className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>No tournaments yet. Create one to get started!</p>
          </div>
        )}
      </div>
    </div>
  );
}