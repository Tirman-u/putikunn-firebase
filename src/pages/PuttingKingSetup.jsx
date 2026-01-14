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
  const [bustReset, setBustReset] = useState(11);
  const [distances, setDistances] = useState([
    { id: 'd1', label: '5m', points: 1, enabled: true, order: 1 },
    { id: 'd2', label: '7m', points: 2, enabled: true, order: 2 },
    { id: 'd3', label: '9m', points: 3, enabled: true, order: 3 }
  ]);
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
        bust_reset_score: data.bustReset,
        distances: data.distances,
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
    mutationFn: async (tournamentId) => {
      // Get all stations and players
      const allStations = await base44.entities.PuttingKingStation.list();
      const tournamentStations = allStations.filter(s => s.tournament_id === tournamentId && s.enabled)
        .sort((a, b) => a.order_index - b.order_index);

      const allPlayers = await base44.entities.PuttingKingPlayer.list();
      const tournamentPlayers = allPlayers.filter(p => p.tournament_id === tournamentId && p.active);

      // Distribute players to stations
      const playersPerStation = 4;
      const shuffledPlayers = [...tournamentPlayers].sort(() => Math.random() - 0.5);

      for (let i = 0; i < tournamentStations.length && i * playersPerStation < shuffledPlayers.length; i++) {
        const station = tournamentStations[i];
        const stationPlayers = shuffledPlayers.slice(i * playersPerStation, (i + 1) * playersPerStation);

        if (stationPlayers.length === 4) {
          // Create initial match
          const match = await base44.entities.PuttingKingMatch.create({
            tournament_id: tournamentId,
            station_id: station.id,
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
              current_match_id: match.id
            });
          }
        }
      }

      // Update tournament status
      await base44.entities.PuttingKingTournament.update(tournamentId, { status: 'active' });
    },
    onSuccess: (_, tournamentId) => {
      queryClient.invalidateQueries();
      navigate(`${createPageUrl('PuttingKingOverview')}?id=${tournamentId}`);
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
      bustReset,
      distances,
      stations,
      players: validPlayers
    });
  };

  const addDistance = () => {
    setDistances([...distances, {
      id: `d${Date.now()}`,
      label: `${distances.length + 3}m`,
      points: distances.length + 1,
      enabled: true,
      order: distances.length + 1
    }]);
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Target Score</label>
                  <Input
                    type="number"
                    value={targetScore}
                    onChange={(e) => setTargetScore(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Bust Reset</label>
                  <Input
                    type="number"
                    value={bustReset}
                    onChange={(e) => setBustReset(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Distances */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">Distances</h3>
              <Button onClick={addDistance} size="sm" variant="outline">
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>
            </div>
            <div className="space-y-3">
              {distances.map((dist, idx) => (
                <div key={dist.id} className="flex items-center gap-3">
                  <Input
                    value={dist.label}
                    onChange={(e) => {
                      const newDist = [...distances];
                      newDist[idx].label = e.target.value;
                      setDistances(newDist);
                    }}
                    placeholder="Distance"
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    value={dist.points}
                    onChange={(e) => {
                      const newDist = [...distances];
                      newDist[idx].points = Number(e.target.value);
                      setDistances(newDist);
                    }}
                    placeholder="Points"
                    className="w-24"
                  />
                  <Button
                    onClick={() => setDistances(distances.filter((_, i) => i !== idx))}
                    size="sm"
                    variant="ghost"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
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
            <Button
              onClick={() => startTournamentMutation.mutate(tournamentId)}
              disabled={startTournamentMutation.isPending}
              className="w-full h-14 bg-green-600 hover:bg-green-700"
            >
              <Play className="w-5 h-5 mr-2" />
              Start Tournament
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}