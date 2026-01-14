import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Trophy } from 'lucide-react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function PuttingKingOverview() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tournamentId = searchParams.get('id');

  const { data: tournament } = useQuery({
    queryKey: ['tournament', tournamentId],
    queryFn: async () => {
      const tournaments = await base44.entities.PuttingKingTournament.list();
      return tournaments.find(t => t.id === tournamentId);
    },
    enabled: !!tournamentId,
    refetchInterval: 2000
  });

  const { data: stations = [] } = useQuery({
    queryKey: ['tournament-stations', tournamentId],
    queryFn: async () => {
      const allStations = await base44.entities.PuttingKingStation.list();
      return allStations.filter(s => s.tournament_id === tournamentId)
        .sort((a, b) => a.order_index - b.order_index);
    },
    enabled: !!tournamentId,
    refetchInterval: 2000
  });

  const { data: matches = [] } = useQuery({
    queryKey: ['tournament-matches', tournamentId],
    queryFn: async () => {
      const allMatches = await base44.entities.PuttingKingMatch.list();
      return allMatches.filter(m => m.tournament_id === tournamentId);
    },
    enabled: !!tournamentId,
    refetchInterval: 2000
  });

  const { data: players = [] } = useQuery({
    queryKey: ['tournament-players', tournamentId],
    queryFn: async () => {
      const allPlayers = await base44.entities.PuttingKingPlayer.list();
      return allPlayers.filter(p => p.tournament_id === tournamentId);
    },
    enabled: !!tournamentId,
    refetchInterval: 2000
  });

  const leaderboard = [...players]
    .sort((a, b) => {
      if (b.tournament_points !== a.tournament_points) {
        return b.tournament_points - a.tournament_points;
      }
      if (b.wins !== a.wins) {
        return b.wins - a.wins;
      }
      const accA = a.total_attempts > 0 ? a.total_made_putts / a.total_attempts : 0;
      const accB = b.total_attempts > 0 ? b.total_made_putts / b.total_attempts : 0;
      return accB - accA;
    });

  const getStationMatch = (stationId) => {
    return matches.find(m => m.station_id === stationId && (m.status === 'ready' || m.status === 'playing'));
  };

  const getPlayerName = (email) => {
    const player = players.find(p => p.user_email === email);
    return player?.user_name || email.split('@')[0];
  };

  if (!tournament) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white p-4">
      <div className="max-w-7xl mx-auto pt-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-800 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Back</span>
        </button>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">{tournament.name}</h1>
          <div className="inline-block px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
            {tournament.status}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Stations */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-bold text-slate-800">Stations</h2>
            {stations.map(station => {
              const match = getStationMatch(station.id);
              return (
                <div key={station.id} className="bg-white rounded-2xl p-6 shadow-sm border-2 border-purple-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-slate-800">{station.name}</h3>
                    {match && (
                      <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        match.status === 'playing' ? 'bg-green-100 text-green-700' :
                        match.status === 'ready' ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {match.status}
                      </div>
                    )}
                  </div>

                  {match ? (
                    <>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="p-4 bg-purple-50 rounded-xl">
                          <div className="text-sm text-purple-600 font-semibold mb-2">Team A</div>
                          {match.team_a_players.map(email => (
                            <div key={email} className="text-slate-800">{getPlayerName(email)}</div>
                          ))}
                          <div className="text-3xl font-bold text-purple-600 mt-2">{match.score_a}</div>
                        </div>
                        <div className="p-4 bg-blue-50 rounded-xl">
                          <div className="text-sm text-blue-600 font-semibold mb-2">Team B</div>
                          {match.team_b_players.map(email => (
                            <div key={email} className="text-slate-800">{getPlayerName(email)}</div>
                          ))}
                          <div className="text-3xl font-bold text-blue-600 mt-2">{match.score_b}</div>
                        </div>
                      </div>
                      <Link to={`${createPageUrl('PuttingKingScoring')}?match=${match.id}`}>
                        <button className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold">
                          Score Match
                        </button>
                      </Link>
                    </>
                  ) : (
                    <div className="text-center py-8 text-slate-400">
                      Waiting for players...
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Leaderboard */}
          <div>
            <h2 className="text-xl font-bold text-slate-800 mb-4">Leaderboard</h2>
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <div className="space-y-3">
                {leaderboard.map((player, idx) => (
                  <div key={player.id} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                      idx === 0 ? 'bg-yellow-400 text-yellow-900' :
                      idx === 1 ? 'bg-slate-300 text-slate-700' :
                      idx === 2 ? 'bg-orange-300 text-orange-800' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-slate-800">{player.user_name}</div>
                      <div className="text-xs text-slate-500">
                        {player.wins}W-{player.losses}L
                        {player.total_attempts > 0 && ` • ${((player.total_made_putts / player.total_attempts) * 100).toFixed(0)}%`}
                      </div>
                    </div>
                    <div className="text-lg font-bold text-purple-600">{player.tournament_points}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}