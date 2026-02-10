import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Plus, Trophy, Settings, Trash2, BookOpen, Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import TournamentRulesDialog from '@/components/putting/TournamentRulesDialog';
import JoinPuttingKing from '@/components/putting/JoinPuttingKing';
import BackButton from '@/components/ui/back-button';

export default function PuttingKing() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showRules, setShowRules] = useState(false);
  const [mode, setMode] = useState(null);

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const userRole = user?.app_role || 'user';
  const canManage = ['trainer', 'admin', 'super_admin'].includes(userRole);

  const { data: activeTournamentRows = [] } = useQuery({
    queryKey: ['putting-king-tournaments', 'active'],
    queryFn: () => base44.entities.PuttingKingTournament.filter({ status: 'active' })
  });

  const { data: myTournaments = [] } = useQuery({
    queryKey: ['putting-king-tournaments', 'host', user?.email],
    queryFn: () => base44.entities.PuttingKingTournament.filter({ host_user: user?.email }),
    enabled: !!user?.email
  });

  const deleteMutation = useMutation({
    mutationFn: (tournamentId) => base44.entities.PuttingKingTournament.delete(tournamentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['putting-king-tournaments'] });
    }
  });

  const activeTournaments = activeTournamentRows.filter(
    t => t.status === 'active' && t.current_round < t.total_rounds
  );

  if (mode === 'join') {
    return (
      <JoinPuttingKing
        onJoin={(tournament) => navigate(`${createPageUrl('PuttingKingOverview')}?id=${tournament.id}`)}
        onBack={() => setMode(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white p-4">
      <div className="max-w-4xl mx-auto pt-8">
        <BackButton className="mb-6" />

        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Trophy className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-slate-800 mb-2">Puttingu Kuningas!</h1>
          <p className="text-slate-600">2v2 turniirivõistlused</p>
          <button
            onClick={() => setShowRules(true)}
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-slate-200 hover:border-purple-300 hover:bg-purple-50 transition-all text-sm font-medium text-slate-700"
          >
            <BookOpen className="w-4 h-4" />
            Reeglid
          </button>
        </div>

        {/* Main Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => setMode('join')}
            className="bg-white hover:bg-purple-50 rounded-2xl p-6 shadow-sm border-2 border-slate-200 hover:border-purple-300 transition-all text-left"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center">
                <Users className="w-7 h-7 text-purple-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">Liitu turniiriga</h3>
                <p className="text-sm text-slate-500">Sisesta PIN, et liituda</p>
              </div>
            </div>
          </button>

          {canManage && (
            <button
              onClick={() => navigate(createPageUrl('PuttingKingSetup'))}
              className="bg-purple-600 hover:bg-purple-700 text-white rounded-2xl p-6 shadow-md transition-all text-left"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
                  <Plus className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Loo turniir</h3>
                  <p className="text-sm text-purple-100">Loo uus turniir</p>
                </div>
              </div>
            </button>
          )}
        </div>

        {/* Active Tournaments */}
        {activeTournaments.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-800 mb-3">Käimasolevad turniirid</h2>
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
                        Eesmärk: {tournament.target_score} • Algas {format(new Date(tournament.created_date), 'MMM d')}
                      </div>
                    </div>
                    <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                      Käimas
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* My Tournaments */}
        {canManage && myTournaments.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-slate-800 mb-3">Minu turniirid</h2>
            <div className="space-y-3">
              {myTournaments.map(tournament => {
               const isTournamentFinished = tournament.current_round === tournament.total_rounds;
               const displayStatus = isTournamentFinished ? 'finished' : tournament.status;
               const displayStatusLabel = displayStatus === 'finished'
                 ? 'lõpetatud'
                 : displayStatus === 'active'
                 ? 'aktiivne'
                 : displayStatus === 'pending'
                 ? 'ootel'
                 : displayStatus;
               return (
               <div key={tournament.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                 <div className="flex items-center justify-between mb-3">
                   <div>
                     <div className="font-bold text-lg text-slate-800">{tournament.name}</div>
                     <div className="text-sm text-slate-500">
                       Staatus: {displayStatusLabel} • Loodud {format(new Date(tournament.created_date), 'MMM d')}
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
                       Vaata
                     </Button>
                   </Link>
                   <Link
                     to={`${createPageUrl('PuttingKingSetup')}?id=${tournament.id}`}
                     className="flex-1"
                   >
                     <Button variant="outline" className="w-full">
                       <Settings className="w-4 h-4 mr-2" />
                       Halda
                     </Button>
                   </Link>
                   <Button
                     onClick={() => {
                       if (confirm(`Kustuta "${tournament.name}"? Seda ei saa tagasi võtta.`)) {
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

        {activeTournamentRows.length === 0 && myTournaments.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <Trophy className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>Turniire pole veel. Loo uus turniir, et alustada!</p>
          </div>
        )}
      </div>

      {showRules && <TournamentRulesDialog onClose={() => setShowRules(false)} />}
    </div>
  );
}
