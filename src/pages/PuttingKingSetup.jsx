import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';

export default function PuttingKingSetup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tournamentId = searchParams.get('id');
  const queryClient = useQueryClient();

  const [tournamentName, setTournamentName] = useState('');
  const [pin, setPin] = useState(() => Math.floor(1000 + Math.random() * 9000).toString());
  const [targetScore, setTargetScore] = useState(21);
  const [stations, setStations] = useState([
    { name: 'Korv 1', order: 1 },
    { name: 'Korv 2', order: 2 }
  ]);

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: tournament, isLoading: tournamentLoading } = useQuery({
    queryKey: ['tournament-edit', tournamentId],
    queryFn: async () => {
      const tournaments = await base44.entities.PuttingKingTournament.list();
      return tournaments.find(t => t.id === tournamentId);
    },
    enabled: !!tournamentId
  });

  const { data: existingStations = [] } = useQuery({
    queryKey: ['tournament-stations-edit', tournamentId],
    queryFn: async () => {
      const allStations = await base44.entities.PuttingKingStation.list();
      return allStations.filter(s => s.tournament_id === tournamentId)
        .sort((a, b) => a.order_index - b.order_index);
    },
    enabled: !!tournamentId
  });

  React.useEffect(() => {
    if (tournament) {
      setTournamentName(tournament.name);
      setPin(tournament.pin);
      setTargetScore(tournament.target_score);
    }
  }, [tournament]);

  React.useEffect(() => {
    if (existingStations.length > 0) {
      setStations(existingStations.map(s => ({ name: s.name, order: s.order_index, id: s.id })));
    }
  }, [existingStations]);

  const createTournamentMutation = useMutation({
    mutationFn: async (data) => {
      // Create tournament
      const tournament = await base44.entities.PuttingKingTournament.create({
        name: data.name,
        pin: data.pin,
        status: 'setup',
        target_score: data.targetScore,
        bust_reset_score: 11,
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
      toast.success('Turniir loodud!');
      navigate(`${createPageUrl('PuttingKingOverview')}?id=${tournament.id}`);
    }
  });

  const updateTournamentMutation = useMutation({
    mutationFn: async (data) => {
      // Update tournament
      await base44.entities.PuttingKingTournament.update(tournamentId, {
        name: data.name,
        target_score: data.targetScore
      });

      // Update/create/delete stations
      const currentStationIds = new Set(existingStations.map(s => s.id));
      
      // Update existing or create new stations
      for (let i = 0; i < data.stations.length; i++) {
        const station = data.stations[i];
        if (station.id && currentStationIds.has(station.id)) {
          // Update existing
          await base44.entities.PuttingKingStation.update(station.id, {
            name: station.name,
            order_index: i + 1
          });
        } else {
          // Create new
          await base44.entities.PuttingKingStation.create({
            tournament_id: tournamentId,
            name: station.name,
            order_index: i + 1,
            enabled: true
          });
        }
      }

      // Delete removed stations
      const newStationIds = new Set(data.stations.filter(s => s.id).map(s => s.id));
      for (const existing of existingStations) {
        if (!newStationIds.has(existing.id)) {
          await base44.entities.PuttingKingStation.delete(existing.id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success('Turniir uuendatud!');
      navigate(`${createPageUrl('PuttingKingOverview')}?id=${tournamentId}`);
    }
  });

  const handleSave = () => {
    if (!tournamentName.trim()) {
      alert('Sisesta turniiri nimi');
      return;
    }

    if (stations.length < 1) {
      alert('Vaja vähemalt 1 jaama');
      return;
    }

    const data = {
      name: tournamentName,
      pin,
      targetScore,
      stations
    };

    if (tournamentId) {
      updateTournamentMutation.mutate(data);
    } else {
      createTournamentMutation.mutate(data);
    }
  };

  const addStation = () => {
    setStations([...stations, {
      name: `Korv ${stations.length + 1}`,
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
          <span className="font-medium">Tagasi</span>
        </button>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">
            {tournamentId ? 'Halda turniiri' : 'Loo turniir'}
          </h1>
          <p className="text-slate-600">
            {tournamentId ? 'Muuda turniiri seadeid' : 'Loo turniir ja lisa mängijad hiljem'}
          </p>
        </div>

        <div className="space-y-6">
          {/* Basic Settings */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-800 mb-4">Põhiseaded</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Turniiri nimi</label>
                <Input
                  value={tournamentName}
                  onChange={(e) => setTournamentName(e.target.value)}
                  placeholder="nt Reede õhtu lahingud"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">PIN-kood</label>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-purple-50 border-2 border-purple-200 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-purple-600 tracking-wider">{pin}</div>
                  </div>
                  <Button
                    onClick={() => {
                      navigator.clipboard.writeText(pin);
                      toast.success('PIN kopeeritud!');
                    }}
                    variant="outline"
                  >
                    Kopeeri
                  </Button>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {tournamentId ? 'PIN-i ei saa muuta' : 'Mängijad kasutavad seda PIN-i liitumiseks'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Eesmärk</label>
                <Input
                  type="number"
                  value={targetScore}
                  onChange={(e) => setTargetScore(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* Stations */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">Jaamad</h3>
              <Button onClick={addStation} size="sm" variant="outline">
                <Plus className="w-4 h-4 mr-1" />
                Lisa
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
                    placeholder="Jaama nimi"
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
            onClick={handleSave}
            disabled={createTournamentMutation.isPending || updateTournamentMutation.isPending || tournamentLoading}
            className="w-full h-14 bg-purple-600 hover:bg-purple-700 text-lg font-bold"
          >
            {tournamentId ? (
              <>
                <Save className="w-5 h-5 mr-2" />
                {updateTournamentMutation.isPending ? 'Salvestan...' : 'Salvesta muudatused'}
              </>
            ) : (
              <>
                {createTournamentMutation.isPending ? 'Loon...' : 'Loo turniir'}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
