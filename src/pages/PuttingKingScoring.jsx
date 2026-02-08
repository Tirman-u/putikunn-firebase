import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import LoadingState from '@/components/ui/loading-state';

export default function PuttingKingScoring() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const matchId = searchParams.get('match');
  const queryClient = useQueryClient();

  const { data: match } = useQuery({
    queryKey: ['match', matchId],
    queryFn: async () => {
      // Mock data to prevent crash, replace with Firestore
      return null;
    },
    enabled: !!matchId,
    refetchInterval: 1000
  });

  const { data: tournament } = useQuery({
    queryKey: ['tournament', match?.tournament_id],
    queryFn: async () => {
      // Mock data, replace with Firestore
      return null;
    },
    enabled: !!match
  });

  const { data: players = [] } = useQuery({
    queryKey: ['match-players', match?.tournament_id],
    queryFn: async () => {
      // Mock data, replace with Firestore
      return [];
    },
    enabled: !!match
  });

  const scoreMutation = useMutation({
    mutationFn: async ({ team, distance, made }) => {
        toast.success("Placeholder");
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
    }
  });

  const getPlayerName = (email) => {
    const player = players.find(p => p.user_email === email);
    return player?.user_name || email.split('@')[0];
  };

  if (!match || !tournament) {
    return <LoadingState />;
  }

  if (match.status === 'finished') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-16 h-16 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Mäng lõpetatud!</h1>
          <p className="text-slate-600 mb-6">Võitja: Tiim {match.winner_team}</p>
          <Button onClick={() => navigate(-1)}>Tagasi ülevaatesse</Button>
        </div>
      </div>
    );
  }

  const distances = tournament.distances.filter(d => d.enabled).sort((a, b) => a.order - b.order);

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white p-4">
      <div className="max-w-2xl mx-auto pt-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-800 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Tagasi</span>
        </button>

        {/* Team Cards with Integrated Scoring */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Team A */}
          <div className="bg-white rounded-2xl shadow-sm border-2 border-purple-300 overflow-hidden">
            <div className="bg-purple-500 text-white p-4 text-center">
              <div className="text-xs font-semibold mb-1 opacity-90">Tiim A</div>
              <div className="text-4xl font-bold mb-2">{match.score_a}</div>
              {match.team_a_players.map(email => (
                <div key={email} className="text-xs opacity-90">{getPlayerName(email)}</div>
              ))}
            </div>
            <div className="p-4 space-y-2">
              {distances.map(distance => (
                <div key={distance.id} className="flex items-center gap-2">
                  <div className="flex-1 font-medium text-slate-700 text-sm">
                    {distance.label} ({distance.points} p)
                  </div>
                  <Button
                    onClick={() => scoreMutation.mutate({ team: 'A', distance, made: true })}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 flex-1"
                    disabled={scoreMutation.isPending}
                  >
                    Sees
                  </Button>
                  <Button
                    onClick={() => scoreMutation.mutate({ team: 'A', distance, made: false })}
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    disabled={scoreMutation.isPending}
                  >
                    Mööda
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Team B */}
          <div className="bg-white rounded-2xl shadow-sm border-2 border-blue-300 overflow-hidden">
            <div className="bg-blue-500 text-white p-4 text-center">
              <div className="text-xs font-semibold mb-1 opacity-90">Tiim B</div>
              <div className="text-4xl font-bold mb-2">{match.score_b}</div>
              {match.team_b_players.map(email => (
                <div key={email} className="text-xs opacity-90">{getPlayerName(email)}</div>
              ))}
            </div>
            <div className="p-4 space-y-2">
              {distances.map(distance => (
                <div key={distance.id} className="flex items-center gap-2">
                  <div className="flex-1 font-medium text-slate-700 text-sm">
                    {distance.label} ({distance.points} p)
                  </div>
                  <Button
                    onClick={() => scoreMutation.mutate({ team: 'B', distance, made: true })}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 flex-1"
                    disabled={scoreMutation.isPending}
                  >
                    Sees
                  </Button>
                  <Button
                    onClick={() => scoreMutation.mutate({ team: 'B', distance, made: false })}
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    disabled={scoreMutation.isPending}
                  >
                    Mööda
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
