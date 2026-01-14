import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

export default function PuttingKingScoring() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const matchId = searchParams.get('match');
  const queryClient = useQueryClient();

  const { data: match } = useQuery({
    queryKey: ['match', matchId],
    queryFn: async () => {
      const matches = await base44.entities.PuttingKingMatch.list();
      return matches.find(m => m.id === matchId);
    },
    enabled: !!matchId,
    refetchInterval: 1000
  });

  const { data: tournament } = useQuery({
    queryKey: ['tournament', match?.tournament_id],
    queryFn: async () => {
      const tournaments = await base44.entities.PuttingKingTournament.list();
      return tournaments.find(t => t.id === match.tournament_id);
    },
    enabled: !!match
  });

  const { data: players = [] } = useQuery({
    queryKey: ['match-players', match?.tournament_id],
    queryFn: async () => {
      const allPlayers = await base44.entities.PuttingKingPlayer.list();
      return allPlayers.filter(p => p.tournament_id === match.tournament_id);
    },
    enabled: !!match
  });

  const scoreMutation = useMutation({
    mutationFn: async ({ team, distance, made }) => {
      const currentScore = team === 'A' ? match.score_a : match.score_b;
      let newScore = currentScore + (made ? distance.points : 0);

      // Risk/reward mechanics on missed putts
      if (!made) {
        const sortedDistances = [...distances].sort((a, b) => a.points - b.points);
        const isShortestDistance = distance.id === sortedDistances[0].id;
        const isFarthestDistance = distance.id === sortedDistances[sortedDistances.length - 1].id;

        if (isShortestDistance) {
          newScore -= 1;
          toast.info('Missed the shortest! -1');
        } else if (isFarthestDistance) {
          newScore += 1;
          toast.success('Good effort from far away! +1');
        }
      }

      // Bust logic
      if (newScore > tournament.target_score) {
        newScore = tournament.bust_reset_score;
        toast.error(`Bust! Score reset to ${tournament.bust_reset_score}`);
      }

      // Update match
      const updateData = {
        [`score_${team.toLowerCase()}`]: newScore
      };

      // Check for win
      if (newScore === tournament.target_score) {
        updateData.status = 'finished';
        updateData.winner_team = team;
        updateData.finished_at = new Date().toISOString();
      }

      const updatedMatch = await base44.entities.PuttingKingMatch.update(match.id, updateData);

      // If match finished, handle rotation
      if (newScore === tournament.target_score) {
        await handleMatchEnd(updatedMatch, team);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
    }
  });

  const handleMatchEnd = async (finishedMatch, winnerTeam) => {
    const winners = winnerTeam === 'A' ? finishedMatch.team_a_players : finishedMatch.team_b_players;
    const losers = winnerTeam === 'A' ? finishedMatch.team_b_players : finishedMatch.team_a_players;

    // Update player points and set partners
    for (const email of winners) {
      const player = players.find(p => p.user_email === email);
      if (player) {
        const partner = winners.find(e => e !== email);
        await base44.entities.PuttingKingPlayer.update(player.id, {
          tournament_points: player.tournament_points + tournament.win_points,
          wins: player.wins + 1,
          current_status: 'waiting_partner',
          last_partner_email: partner
        });
      }
    }

    for (const email of losers) {
      const player = players.find(p => p.user_email === email);
      if (player) {
        const partner = losers.find(e => e !== email);
        await base44.entities.PuttingKingPlayer.update(player.id, {
          losses: player.losses + 1,
          current_status: 'waiting_partner',
          last_partner_email: partner
        });
      }
    }

    toast.success('Match finished!');
    setTimeout(() => navigate(-1), 1500);
  };

  const getPlayerName = (email) => {
    const player = players.find(p => p.user_email === email);
    return player?.user_name || email.split('@')[0];
  };

  if (!match || !tournament) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (match.status === 'finished') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-16 h-16 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Match Finished!</h1>
          <p className="text-slate-600 mb-6">Winner: Team {match.winner_team}</p>
          <Button onClick={() => navigate(-1)}>Back to Overview</Button>
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
          <span className="font-medium">Back</span>
        </button>

        {/* Team Cards with Integrated Scoring */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Team A */}
          <div className="bg-white rounded-2xl shadow-sm border-2 border-purple-300 overflow-hidden">
            <div className="bg-purple-500 text-white p-4 text-center">
              <div className="text-xs font-semibold mb-1 opacity-90">Team A</div>
              <div className="text-4xl font-bold mb-2">{match.score_a}</div>
              {match.team_a_players.map(email => (
                <div key={email} className="text-xs opacity-90">{getPlayerName(email)}</div>
              ))}
            </div>
            <div className="p-4 space-y-2">
              {distances.map(distance => (
                <div key={distance.id} className="flex items-center gap-2">
                  <div className="flex-1 font-medium text-slate-700 text-sm">
                    {distance.label} ({distance.points}pts)
                  </div>
                  <Button
                    onClick={() => scoreMutation.mutate({ team: 'A', distance, made: true })}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 flex-1"
                    disabled={scoreMutation.isPending}
                  >
                    Made
                  </Button>
                  <Button
                    onClick={() => scoreMutation.mutate({ team: 'A', distance, made: false })}
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    disabled={scoreMutation.isPending}
                  >
                    Miss
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Team B */}
          <div className="bg-white rounded-2xl shadow-sm border-2 border-blue-300 overflow-hidden">
            <div className="bg-blue-500 text-white p-4 text-center">
              <div className="text-xs font-semibold mb-1 opacity-90">Team B</div>
              <div className="text-4xl font-bold mb-2">{match.score_b}</div>
              {match.team_b_players.map(email => (
                <div key={email} className="text-xs opacity-90">{getPlayerName(email)}</div>
              ))}
            </div>
            <div className="p-4 space-y-2">
              {distances.map(distance => (
                <div key={distance.id} className="flex items-center gap-2">
                  <div className="flex-1 font-medium text-slate-700 text-sm">
                    {distance.label} ({distance.points}pts)
                  </div>
                  <Button
                    onClick={() => scoreMutation.mutate({ team: 'B', distance, made: true })}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 flex-1"
                    disabled={scoreMutation.isPending}
                  >
                    Made
                  </Button>
                  <Button
                    onClick={() => scoreMutation.mutate({ team: 'B', distance, made: false })}
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    disabled={scoreMutation.isPending}
                  >
                    Miss
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