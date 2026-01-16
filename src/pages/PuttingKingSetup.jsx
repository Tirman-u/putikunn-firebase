import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function PuttingKingSetup() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [tournamentName, setTournamentName] = useState('');
  const [pin] = useState(() => Math.floor(1000 + Math.random() * 9000).toString());
  const [targetScore, setTargetScore] = useState(21);
  const [totalRounds, setTotalRounds] = useState(6);
  const [stations, setStations] = useState([
    { name: 'Basket 1', order: 1 },
    { name: 'Basket 2', order: 2 }
  ]);

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const createTournamentMutation = useMutation({
    mutationFn: async (data) => {
      // Create tournament
      const tournament = await base44.entities.PuttingKingTournament.create({
        name: data.name,
        pin: data.pin,
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
      for (const station of data.stations) {
        await base44.entities.PuttingKingStation.create({
          tournament_id: tournament.id,
          name: station.name,
          order_index: station.order,
          enabled: true
        });
      }

      return tournament;
    },
    onSuccess: (tournament) => {
      queryClient.invalidateQueries({ queryKey: ['putting-king-tournaments'] });
      navigate(`${createPageUrl('PuttingKingOverview')}?id=${tournament.id}`);
    }
  });

  const handleCreateTournament = () => {
    if (!tournamentName.trim()) {
      alert('Please enter tournament name');
      return;
    }

    if (stations.length < 1) {
      alert('Need at least 1 station');
      return;
    }

    createTournamentMutation.mutate({
      name: tournamentName,
      pin,
      targetScore,
      totalRounds,
      stations
    });
  };

  const addStation = () => {
    setStations([...stations, {
      name: `Basket ${stations.length + 1}`,
      order: stations.length + 1
    }]);
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
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Setup Tournament</h1>
          <p className="text-slate-600">Create tournament and add players afterwards</p>
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
                <label className="block text-sm font-medium text-slate-700 mb-2">PIN Code</label>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-purple-50 border-2 border-purple-200 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-purple-600 tracking-wider">{pin}</div>
                  </div>
                  <Button
                    onClick={() => navigator.clipboard.writeText(pin)}
                    variant="outline"
                  >
                    Copy
                  </Button>
                </div>
                <p className="text-xs text-slate-500 mt-1">Players will use this PIN to join</p>
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
                  {stations.length > 1 && (
                    <Button
                      onClick={() => setStations(stations.filter((_, i) => i !== idx))}
                      size="icon"
                      variant="ghost"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <Button
            onClick={handleCreateTournament}
            disabled={createTournamentMutation.isPending}
            className="w-full h-14 bg-purple-600 hover:bg-purple-700 text-lg font-bold"
          >
            {createTournamentMutation.isPending ? 'Creating...' : 'Create Tournament'}
          </Button>
        </div>
      </div>
    </div>
  );
}