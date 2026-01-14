import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
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
    mutationFn: async ({ playerEmail, distance, made, points }) => {
      const team = match.team_a_players.includes(playerEmail) ? 'A' : 'B';
      const currentScore = team === 'A' ? match.score_a : match.score_b;
      let newScore = currentScore + (made ? points : 0);

      // Bust logic
      if (newScore > tournament.target_score) {
        newScore = tournament.bust_reset_score;
        toast.error(`Bust! Score reset to ${tournament.bust_reset_score}`);
      }

      // Update match
      const updateData = {
        [`score_${team.toLowerCase()}`]: newScore,
        events: [...(match.events || []), {
          player: playerEmail,
          distance: distance.label,
          made,
          points: made ? points : 0,
          timestamp: new Date().toISOString()
        }]
      };

      // Check for win
      if (newScore === tournament.target_score) {
        updateData.status = 'finished';
        updateData.winner_team = team;
        updateData.finished_at = new Date().toISOString();
      }

      const updatedMatch = await base44.entities.PuttingKingMatch.update(match.id, updateData);

      // Update player stats
      const player = players.find(p => p.user_email === playerEmail);
      if (player) {
        const statsByDist = { ...(player.stats_by_distance || {}) };
        if (!statsByDist[distance.label]) {
          statsByDist[distance.label] = { made: 0, attempts: 0 };
        }
        statsByDist[distance.label].attempts += 1;
        if (made) statsByDist[distance.label].made += 1;

        await base44.entities.PuttingKingPlayer.update(player.id, {
          total_attempts: player.total_attempts + 1,
          total_made_putts: player.total_made_putts + (made ? 1 : 0),
          stats_by_distance: statsByDist
        });
      }

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

    // Update player points
    for (const email of winners) {
      const player = players.find(p => p.user_email === email);
      if (player) {
        await base44.entities.PuttingKingPlayer.update(player.id, {
          tournament_points: player.tournament_points + tournament.win_points,
          wins: player.wins + 1,
          current_status: 'waiting_partner'
        });
      }
    }

    for (const email of losers) {
      const player = players.find(p => p.user_email === email);
      if (player) {
        await base44.entities.PuttingKingPlayer.update(player.id, {
          losses: player.losses + 1,
          current_status: 'waiting_partner'
        });
      }
    }

    toast.success('Match finished! Rotation starting...');
    setTimeout(() => navigate(-1), 2000);
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

  const allPlayers = [...match.team_a_players, ...match.team_b_players];
  const distances = tournament.distances.filter(d => d.enabled).sort((a, b) => a.order - b.order);

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

        {/* Scores */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-purple-500 text-white rounded-2xl p-6 text-center">
            <div className="text-sm font-semibold mb-2">Team A</div>
            {match.team_a_players.map(email => (
              <div key={email} className="text-sm opacity-90">{getPlayerName(email)}</div>
            ))}
            <div className="text-5xl font-bold mt-4">{match.score_a}</div>
          </div>
          <div className="bg-blue-500 text-white rounded-2xl p-6 text-center">
            <div className="text-sm font-semibold mb-2">Team B</div>
            {match.team_b_players.map(email => (
              <div key={email} className="text-sm opacity-90">{getPlayerName(email)}</div>
            ))}
            <div className="text-5xl font-bold mt-4">{match.score_b}</div>
          </div>
        </div>

        {/* Scoring */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <h3 className="font-bold text-slate-800 mb-4">Score Putts</h3>
          <div className="space-y-4">
            {distances.map(distance => (
              <div key={distance.id} className="border-b border-slate-200 pb-4 last:border-0">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="font-bold text-slate-800">{distance.label}</span>
                    <span className="ml-2 text-sm text-slate-500">{distance.points} pts</span>
                  </div>
                </div>
                <div className="space-y-2">
                  {allPlayers.map(email => (
                    <div key={email} className="flex items-center gap-2">
                      <div className="flex-1 text-sm text-slate-700">{getPlayerName(email)}</div>
                      <Button
                        onClick={() => scoreMutation.mutate({ playerEmail: email, distance, made: true, points: distance.points })}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        disabled={scoreMutation.isPending}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Made
                      </Button>
                      <Button
                        onClick={() => scoreMutation.mutate({ playerEmail: email, distance, made: false, points: 0 })}
                        size="sm"
                        variant="outline"
                        disabled={scoreMutation.isPending}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Miss
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}