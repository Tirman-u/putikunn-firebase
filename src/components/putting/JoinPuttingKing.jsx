import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trophy, Calendar } from 'lucide-react';
import BackButton from '@/components/ui/back-button';

export default function JoinPuttingKing({ onJoin, onBack }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: tournaments = [] } = useQuery({
    queryKey: ['active-tournaments'],
    queryFn: () => base44.entities.PuttingKingTournament.filter({
      status: { $in: ['active', 'setup'] }
    }),
    refetchInterval: 5000
  });

  const handleJoin = async () => {
    setError('');
    if (pin.length !== 4) {
      setError('PIN peab olema 4-kohaline');
      return;
    }

    const tournament = tournaments.find(t => t.pin === pin);
    if (!tournament) {
      setError('Vale PIN');
      return;
    }

    await joinTournament(tournament);
  };

  const handleQuickJoin = async (tournament) => {
    await joinTournament(tournament);
  };

  const joinTournament = async (tournament) => {
    try {
      // Check if tournament is still joinable (setup or active only)
      if (tournament.status === 'finished' || tournament.status === 'paused') {
        setError('See turniir ei võta enam mängijaid vastu');
        return;
      }

      // Check if tournament has completed all rounds
      const tournamentMatches = await base44.entities.PuttingKingMatch.filter({
        tournament_id: tournament.id,
        round_number: tournament.current_round
      });
      const allMatchesFinished = tournamentMatches.length > 0 && tournamentMatches.every(m => m.status === 'finished');
      const isTournamentComplete = tournament.current_round === tournament.total_rounds && allMatchesFinished;
      
      if (isTournamentComplete) {
        setError('See turniir on juba lõppenud');
        return;
      }

      // Check if user is already a player
      const [existingPlayer] = await base44.entities.PuttingKingPlayer.filter({
        tournament_id: tournament.id,
        user_email: user.email
      }, null, 1);

      if (!existingPlayer) {
        // Add user as a player with display_name (nickname) or fallback to full_name
        await base44.entities.PuttingKingPlayer.create({
          tournament_id: tournament.id,
          user_email: user.email,
          user_name: user.display_name || user.full_name || user.email.split('@')[0],
          active: true,
          tournament_points: 0,
          wins: 0,
          losses: 0,
          total_made_putts: 0,
          total_attempts: 0,
          stats_by_distance: {}
        });
      }

      onJoin(tournament);
    } catch (error) {
      setError('Turniiriga liitumine ebaõnnestus');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white p-4">
      <div className="max-w-lg mx-auto pt-16">
        <div className="mb-8">
          <BackButton onClick={onBack} />
        </div>

        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-10 h-10 text-purple-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Liitu turniiriga</h1>
          <p className="text-slate-600">Sisesta PIN, et liituda Putting King turniiriga</p>
        </div>

        {/* PIN Input */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">Turniiri PIN</label>
          <div className="flex gap-3">
            <Input
              type="text"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="1234"
              className="text-2xl text-center tracking-wider"
              maxLength={4}
            />
            <Button onClick={handleJoin} className="bg-purple-600 hover:bg-purple-700 px-8">
              Liitu
            </Button>
          </div>
          {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
        </div>

        {/* Active Tournaments */}
        {tournaments.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Käimasolevad turniirid</h3>
            <div className="space-y-3">
              {tournaments.map(tournament => (
                <button
                  key={tournament.id}
                  onClick={() => handleQuickJoin(tournament)}
                  className="w-full bg-white rounded-xl p-4 shadow-sm border border-slate-200 hover:border-purple-300 hover:shadow-md transition-all text-left"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-800">{tournament.name}</h4>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                        <Calendar className="w-3 h-3" />
                        <span>Ring {tournament.current_round}/{tournament.total_rounds}</span>
                      </div>
                    </div>
                    <div className="bg-purple-100 px-3 py-1 rounded-lg">
                      <div className="text-xs text-purple-600 font-semibold">PIN</div>
                      <div className="text-lg font-bold text-purple-700">{tournament.pin}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded ${
                      tournament.status === 'active' ? 'bg-green-100 text-green-700' : 
                      tournament.status === 'setup' ? 'bg-blue-100 text-blue-700' : 
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {tournament.status === 'active' ? 'Aktiivne' : 
                       tournament.status === 'setup' ? 'Seadistus' : 
                       tournament.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
