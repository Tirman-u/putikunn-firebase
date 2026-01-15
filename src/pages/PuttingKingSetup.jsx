import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Plus, Trash2, Play, Settings as SettingsIcon } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function PuttingKingSetup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tournamentId = searchParams.get('id');
  const queryClient = useQueryClient();

  const [tournamentName, setTournamentName] = useState('');
  const [targetScore, setTargetScore] = useState(21);
  const [totalRounds, setTotalRounds] = useState(6);
  const [stations, setStations] = useState([
    { name: 'Basket 1', order: 1 },
    { name: 'Basket 2', order: 2 }
  ]);
  const [playerEmails, setPlayerEmails] = useState(['']);

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const createTournamentMutation = useMutation({
    mutationFn: async (data) => {
      // Create tournament
      const tournament = await base44.entities.PuttingKingTournament.create({
        name: data.name,
        status: 'setup',
        target_score: data.targetScore,
        bust_reset_score: 11,
        total_rounds: data.totalRounds,
        current_round: 1,
        distances: [
          { id: 'd1', label: '5m', points_for_made: 1, points_for_missed: 0, enabled: true, order: 1 },
          { id: 'd2', label: '7m', points_for_made: 2, points_for_missed: -1, enabled: true, order: 2 },
          { id: 'd3', label: '9m', points_for_made: 3, points_for_missed: -2, enabled: true, order: 3 },
          { id: 'd4', label: '11m', points_for_made: 5, points_for_missed: -3, enabled: true, order: 4 }
        ],
        host_user: user.email
      });

      // Create stations
      const stationPromises = data.stations.map(station =>
        base44.entities.PuttingKingStation.create({
          tournament_id: tournament.id,
          name: station.name,
          order_index: station.order,
          enabled: true
        })
      );
      await Promise.all(stationPromises);

      // Create players
      const playerPromises = data.players.map(async email => {
        const users = await base44.entities.User.list();
        const u = users.find(usr => usr.email === email);
        return base44.entities.PuttingKingPlayer.create({
          tournament_id: tournament.id,
          user_email: email,
          user_name: u?.full_name || email,
          active: true,
          current_status: 'idle'
        });
      });
      await Promise.all(playerPromises);

      return tournament;
    },
    onSuccess: (tournament) => {
      queryClient.invalidateQueries({ queryKey: ['putting-king-tournaments'] });
      navigate(`${createPageUrl('PuttingKingSetup')}?id=${tournament.id}`);
    }
  });

  const startTournamentMutation = useMutation({
    mutationFn: async ({ tournamentId, shuffledPlayers }) => {
      // Get all stations
      const allStations = await base44.entities.PuttingKingStation.list();
      const tournamentStations = allStations.filter(s => s.tournament_id === tournamentId && s.enabled)
        .sort((a, b) => a.order_index - b.order_index);

      // Distribute players to stations
      const playersPerStation = 4;

      for (let i = 0; i < tournamentStations.length && i * playersPerStation < shuffledPlayers.length; i++) {
        const station = tournamentStations[i];
        const stationPlayers = shuffledPlayers.slice(i * playersPerStation, (i + 1) * playersPerStation);

        if (stationPlayers.length === 4) {
          // Create initial match for round 1
          const match = await base44.entities.PuttingKingMatch.create({
            tournament_id: tournamentId,
            station_id: station.id,
            round_number: 1,
            status: 'ready',
            team_a_players: [stationPlayers[0].user_email, stationPlayers[1].user_email],
            team_b_players: [stationPlayers[2].user_email, stationPlayers[3].user_email],
            score_a: 0,
            score_b: 0
          });

          // Update player states
          for (const player of stationPlayers) {
            await base44.entities.PuttingKingPlayer.update(player.id, {
              current_status: 'ready',
              current_station_id: station.id,
              current_match_id: match.id,
              last_partner_email: null
            });
          }
        }
      }

      // Update tournament status
      await base44.entities.PuttingKingTournament.update(tournamentId, { status: 'active', current_round: 1 });
    },
    onSuccess: (_, { tournamentId }) => {
      queryClient.invalidateQueries();
      navigate(`${createPageUrl('PuttingKingOverview')}?id=${tournamentId}`);
    }
  });

  const shufflePlayersMutation = useMutation({
    mutationFn: async (tournamentId) => {
      const allPlayers = await base44.entities.PuttingKingPlayer.list();
      const tournamentPlayers = allPlayers.filter(p => p.tournament_id === tournamentId && p.active);
      return [...tournamentPlayers].sort(() => Math.random() - 0.5);
    }
  });

  const handleCreate = () => {
    const validPlayers = playerEmails.filter(e => e.trim());
    if (!tournamentName || validPlayers.length < 4) {
      alert('Need tournament name and at least 4 players');
      return;
    }

    createTournamentMutation.mutate({
      name: tournamentName,
      targetScore,
      totalRounds,
      stations,
      players: validPlayers
    });
  };



  const addStation = () => {
    setStations([...stations, {
      name: `Basket ${stations.length + 1}`,
      order: stations.length + 1
    }]);
  };

  const addPlayer = () => {
    setPlayerEmails([...playerEmails, '']);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white p-4">
      <div className="max-w-2xl mx-auto pt-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-800 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Back</span>
        </button>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">
            {tournamentId ? 'Manage Tournament' : 'Setup Tournament'}
          </h1>
        </div>

        <div className="space-y-6">
          {/* Basic Settings */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-800 mb-4">Basic Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Tournament Name</label>
                <Input
                  value={tournamentName}
                  onChange={(e) => setTournamentName(e.target.value)}
                  placeholder="e.g., Friday Night Battles"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Target Score</label>
                <Input
                  type="number"
                  value={targetScore}
                  onChange={(e) => setTargetScore(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Total Rounds</label>
                <Input
                  type="number"
                  value={totalRounds}
                  onChange={(e) => setTotalRounds(Number(e.target.value))}
                  min={1}
                  max={20}
                />
                <p className="text-xs text-slate-500 mt-1">How many rounds to play (default: 6)</p>
              </div>
            </div>
          </div>

          {/* Stations */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">Stations</h3>
              <Button onClick={addStation} size="sm" variant="outline">
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>
            </div>
            <div className="space-y-3">
              {stations.map((station, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <Input
                    value={station.name}
                    onChange={(e) => {
                      const newStations = [...stations];
                      newStations[idx].name = e.target.value;
                      setStations(newStations);
                    }}
                    placeholder="Station name"
                  />
                  <Button
                    onClick={() => setStations(stations.filter((_, i) => i !== idx))}
                    size="sm"
                    variant="ghost"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Players */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">Players (min 4)</h3>
              <Button onClick={addPlayer} size="sm" variant="outline">
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>
            </div>
            <div className="space-y-3">
              {playerEmails.map((email, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      const newEmails = [...playerEmails];
                      newEmails[idx] = e.target.value;
                      setPlayerEmails(newEmails);
                    }}
                    placeholder="player@example.com"
                  />
                  <Button
                    onClick={() => setPlayerEmails(playerEmails.filter((_, i) => i !== idx))}
                    size="sm"
                    variant="ghost"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          {!tournamentId ? (
            <Button
              onClick={handleCreate}
              disabled={createTournamentMutation.isPending}
              className="w-full h-14 bg-purple-600 hover:bg-purple-700"
            >
              Create Tournament
            </Button>
          ) : (
            <div className="space-y-3">
              <Button
                onClick={async () => {
                  const allPlayers = await base44.entities.PuttingKingPlayer.list();
                  const tournamentPlayers = allPlayers.filter(p => p.tournament_id === tournamentId && p.active);
                  const shuffled = [...tournamentPlayers].sort(() => Math.random() - 0.5);
                  startTournamentMutation.mutate({ tournamentId, shuffledPlayers: shuffled });
                }}
                disabled={startTournamentMutation.isPending}
                className="w-full h-14 bg-green-600 hover:bg-green-700"
              >
                <Play className="w-5 h-5 mr-2" />
                Shuffle & Start Tournament
              </Button>
              <p className="text-xs text-center text-slate-500">
                Players will be randomly shuffled and assigned to stations
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}