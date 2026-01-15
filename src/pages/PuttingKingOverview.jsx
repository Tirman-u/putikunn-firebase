import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trophy, Play } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import PuttingKingScoreInput from '@/components/putting/PuttingKingScoreInput';
import SuddenDeathDialog from '@/components/putting/SuddenDeathDialog';

export default function PuttingKingOverview() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tournamentId = searchParams.get('id');
  const queryClient = useQueryClient();
  const [activeScoringMatchId, setActiveScoringMatchId] = useState(null);
  const [suddenDeathMatch, setSuddenDeathMatch] = useState(null);

  const { data: tournament } = useQuery({
    queryKey: ['tournament', tournamentId],
    queryFn: async () => {
      const tournaments = await base44.entities.PuttingKingTournament.list();
      return tournaments.find(t => t.id === tournamentId);
    },
    enabled: !!tournamentId,
    refetchInterval: 5000
  });

  const { data: stations = [] } = useQuery({
    queryKey: ['tournament-stations', tournamentId],
    queryFn: async () => {
      const allStations = await base44.entities.PuttingKingStation.list();
      return allStations.filter(s => s.tournament_id === tournamentId)
        .sort((a, b) => a.order_index - b.order_index);
    },
    enabled: !!tournamentId,
    refetchInterval: 5000
  });

  const { data: matches = [] } = useQuery({
    queryKey: ['tournament-matches', tournamentId],
    queryFn: async () => {
      const allMatches = await base44.entities.PuttingKingMatch.list();
      return allMatches.filter(m => m.tournament_id === tournamentId);
    },
    enabled: !!tournamentId,
    refetchInterval: 3000
  });

  const { data: players = [] } = useQuery({
    queryKey: ['tournament-players', tournamentId],
    queryFn: async () => {
      const allPlayers = await base44.entities.PuttingKingPlayer.list();
      return allPlayers.filter(p => p.tournament_id === tournamentId);
    },
    enabled: !!tournamentId,
    refetchInterval: 5000
  });

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
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
    // Get the most recent match for this station (including finished ones if no active match)
    const activeMatch = matches.find(m => m.station_id === stationId && (m.status === 'ready' || m.status === 'playing'));
    if (activeMatch) return activeMatch;
    
    // If no active match, show the last finished match
    const finishedMatches = matches
      .filter(m => m.station_id === stationId && m.status === 'finished')
      .sort((a, b) => new Date(b.finished_at || 0) - new Date(a.finished_at || 0));
    
    return finishedMatches[0];
  };

  const getPlayerName = (email) => {
    const player = players.find(p => p.user_email === email);
    return player?.user_name || email.split('@')[0];
  };

  // Check if all current round matches are finished
  const currentRoundMatches = matches.filter(m => m.round_number === tournament?.current_round);
  const allMatchesFinished = currentRoundMatches.length > 0 && currentRoundMatches.every(m => m.status === 'finished');
  const canStartNextRound = allMatchesFinished && tournament?.current_round < tournament?.total_rounds;
  const isTournamentFinished = tournament?.current_round === tournament?.total_rounds && allMatchesFinished;
  const isHost = user?.email === tournament?.host_user;
  const displayStatus = isTournamentFinished ? 'finished' : tournament?.status;

  const scoreMutation = useMutation({
    mutationFn: async ({ matchId, scoreData }) => {
      const match = matches.find(m => m.id === matchId);
      
      if (scoreData.isManual) {
        // Manual score entry
        const finalScoreA = scoreData.finalScoreA;
        const finalScoreB = scoreData.finalScoreB;
        
        // Check if match is finished: someone has exactly 21
        const teamAWon = finalScoreA === tournament.target_score && finalScoreB < tournament.target_score;
        const teamBWon = finalScoreB === tournament.target_score && finalScoreA < tournament.target_score;
        const isTie = finalScoreA === tournament.target_score && finalScoreB === tournament.target_score;
        
        if (isTie) {
          // Sudden death for tie at 21-21
          await base44.entities.PuttingKingMatch.update(matchId, {
            score_a: finalScoreA,
            score_b: finalScoreB,
            status: 'playing'
          });
          setSuddenDeathMatch({ ...match, score_a: finalScoreA, score_b: finalScoreB });
          return;
        }
        
        if (teamAWon || teamBWon) {
          // Someone won
          const winnerTeam = teamAWon ? 'A' : 'B';
          await base44.entities.PuttingKingMatch.update(matchId, {
            score_a: finalScoreA,
            score_b: finalScoreB,
            status: 'finished',
            winner_team: winnerTeam,
            finished_at: new Date().toISOString()
          });
          
          await handleMatchEnd({ ...match, score_a: finalScoreA, score_b: finalScoreB }, winnerTeam, finalScoreA, finalScoreB);
          setActiveScoringMatchId(null);
        } else {
          // Game still in progress
          await base44.entities.PuttingKingMatch.update(matchId, {
            score_a: finalScoreA,
            score_b: finalScoreB,
            status: 'playing'
          });
        }
        return;
      }
      
      // Putt-by-putt scoring
      const { team, distance, made } = scoreData;
      const currentScore = team === 'A' ? match.score_a : match.score_b;
      let newScore = currentScore + (made ? distance.points_for_made : distance.points_for_missed);

      // Bust logic
      if (newScore > tournament.target_score) {
        newScore = tournament.bust_reset_score;
        toast.error(`Bust! Score reset to ${tournament.bust_reset_score}`);
      }

      const updateData = {
        [`score_${team.toLowerCase()}`]: newScore
      };

      // Check for win
      if (newScore === tournament.target_score) {
        updateData.status = 'finished';
        updateData.winner_team = team;
        updateData.finished_at = new Date().toISOString();
      }

      await base44.entities.PuttingKingMatch.update(matchId, updateData);

      if (newScore === tournament.target_score) {
        await handleMatchEnd(
          { ...match, ...updateData }, 
          team, 
          team === 'A' ? newScore : match.score_a,
          team === 'B' ? newScore : match.score_b
        );
        setActiveScoringMatchId(null);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
    }
  });

  const handleMatchEnd = async (finishedMatch, winnerTeam, finalScoreA, finalScoreB) => {
    const winners = winnerTeam === 'A' ? finishedMatch.team_a_players : finishedMatch.team_b_players;
    const losers = winnerTeam === 'A' ? finishedMatch.team_b_players : finishedMatch.team_a_players;

    // Update player points based on actual scores
    for (const email of winners) {
      const player = players.find(p => p.user_email === email);
      if (player) {
        const partner = winners.find(e => e !== email);
        await base44.entities.PuttingKingPlayer.update(player.id, {
          tournament_points: player.tournament_points + finalScoreA,
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
          tournament_points: player.tournament_points + finalScoreB,
          losses: player.losses + 1,
          current_status: 'waiting_partner',
          last_partner_email: partner
        });
      }
    }

    toast.success('Match finished!');
  };

  const handleSuddenDeathWinner = async (winnerTeam) => {
    const match = suddenDeathMatch;
    const finalScoreA = winnerTeam === 'A' ? match.score_a + 1 : match.score_a;
    const finalScoreB = winnerTeam === 'B' ? match.score_b + 1 : match.score_b;
    
    await base44.entities.PuttingKingMatch.update(match.id, {
      score_a: finalScoreA,
      score_b: finalScoreB,
      status: 'finished',
      winner_team: winnerTeam,
      finished_at: new Date().toISOString()
    });
    
    await handleMatchEnd(match, winnerTeam, finalScoreA, finalScoreB);
    setSuddenDeathMatch(null);
    setActiveScoringMatchId(null);
    queryClient.invalidateQueries();
  };

  const startNextRoundMutation = useMutation({
    mutationFn: async () => {
      const nextRound = tournament.current_round + 1;
      
      // Get all stations
      const allStations = await base44.entities.PuttingKingStation.list();
      const tournamentStations = allStations.filter(s => s.tournament_id === tournament.id && s.enabled)
        .sort((a, b) => a.order_index - b.order_index);

      // Get all players sorted individually by performance (Mexicano style)
      const allPlayers = await base44.entities.PuttingKingPlayer.list();
      const tournamentPlayers = allPlayers
        .filter(p => p.tournament_id === tournament.id && p.active)
        .sort((a, b) => {
          if (b.tournament_points !== a.tournament_points) {
            return b.tournament_points - a.tournament_points;
          }
          return b.wins - a.wins;
        });

      const playersPerStation = 4;
      
      // Create new matches with rotation - distribute players to stations
      for (let i = 0; i < tournamentStations.length && i * playersPerStation < tournamentPlayers.length; i++) {
        const station = tournamentStations[i];
        const stationPlayers = tournamentPlayers.slice(i * playersPerStation, (i + 1) * playersPerStation);

        if (stationPlayers.length === 4) {
          const [p1, p2, p3, p4] = stationPlayers;
          
          // Create teams avoiding last round partners
          let teamA = [p1.user_email, p2.user_email];
          let teamB = [p3.user_email, p4.user_email];
          
          // Try different combinations to avoid repeating partners
          if (p1.last_partner_email === p2.user_email) {
            teamA = [p1.user_email, p3.user_email];
            teamB = [p2.user_email, p4.user_email];
          } else if (p3.last_partner_email === p4.user_email) {
            teamA = [p1.user_email, p3.user_email];
            teamB = [p2.user_email, p4.user_email];
          }

          const match = await base44.entities.PuttingKingMatch.create({
            tournament_id: tournament.id,
            station_id: station.id,
            round_number: nextRound,
            status: 'ready',
            team_a_players: teamA,
            team_b_players: teamB,
            score_a: 0,
            score_b: 0
          });

          // Update player states with new partners
          for (const player of stationPlayers) {
            const partner = teamA.includes(player.user_email)
              ? teamA.find(e => e !== player.user_email)
              : teamB.find(e => e !== player.user_email);
              
            await base44.entities.PuttingKingPlayer.update(player.id, {
              current_status: 'ready',
              current_station_id: station.id,
              current_match_id: match.id,
              last_partner_email: partner
            });
          }
        }
      }

      // Update tournament to next round
      await base44.entities.PuttingKingTournament.update(tournament.id, { 
        current_round: nextRound 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success(`Round ${tournament.current_round + 1} started!`);
    }
  });

  if (!tournament) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  const distances = tournament.distances.filter(d => d.enabled).sort((a, b) => a.order - b.order);
  const activeScoringMatch = activeScoringMatchId ? matches.find(m => m.id === activeScoringMatchId) : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white p-4">
      {suddenDeathMatch && (
        <SuddenDeathDialog
          match={suddenDeathMatch}
          onSelectWinner={handleSuddenDeathWinner}
          getPlayerName={getPlayerName}
        />
      )}
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
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className={`inline-block px-4 py-2 rounded-full text-sm font-semibold ${
              displayStatus === 'finished' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
            }`}>
              {displayStatus}
            </div>
            <div className="inline-block px-4 py-2 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold">
              Round {tournament.current_round} / {tournament.total_rounds}
            </div>
          </div>

          {/* Start Next Round Button (Host Only) */}
          {isHost && allMatchesFinished && (
            <div className="flex flex-col items-center gap-2">
              {canStartNextRound ? (
                <Button
                  onClick={() => startNextRoundMutation.mutate()}
                  disabled={startNextRoundMutation.isPending}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start Round {tournament.current_round + 1}
                </Button>
              ) : (
                <div className="px-4 py-2 bg-amber-100 text-amber-700 rounded-full text-sm font-semibold">
                  Tournament Complete!
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Stations and Scoring */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-bold text-slate-800">Stations</h2>
            {stations.map(station => {
              const match = getStationMatch(station.id);
              const isActiveScoring = activeScoringMatchId === match?.id;
              return (
                <div key={station.id} className="bg-white rounded-2xl p-4 shadow-sm border-2 border-purple-200">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold text-slate-800">{station.name}</h3>
                    {match && (
                      <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        match.status === 'playing' ? 'bg-green-100 text-green-700' :
                        match.status === 'ready' ? 'bg-blue-100 text-blue-700' :
                        match.status === 'finished' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {match.status === 'finished' ? 'Finished' : match.status}
                      </div>
                    )}
                  </div>

                  {match ? (
                    <>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="p-3 bg-purple-50 rounded-xl">
                          <div className="text-xs text-purple-600 font-semibold mb-1">Team A</div>
                          {match.team_a_players.map(email => (
                            <div key={email} className="text-sm text-slate-800">{getPlayerName(email)}</div>
                          ))}
                          <div className="text-2xl font-bold text-purple-600 mt-2">{match.score_a}</div>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-xl">
                          <div className="text-xs text-blue-600 font-semibold mb-1">Team B</div>
                          {match.team_b_players.map(email => (
                            <div key={email} className="text-sm text-slate-800">{getPlayerName(email)}</div>
                          ))}
                          <div className="text-2xl font-bold text-blue-600 mt-2">{match.score_b}</div>
                        </div>
                      </div>

                      {match.status !== 'finished' && (
                        isActiveScoring ? (
                          <PuttingKingScoreInput
                            match={match}
                            tournament={tournament}
                            distances={distances}
                            onScore={(scoreData) => scoreMutation.mutate({ matchId: match.id, scoreData })}
                            getPlayerName={getPlayerName}
                          />
                        ) : (
                          <Button
                            onClick={() => setActiveScoringMatchId(match.id)}
                            className="w-full bg-purple-600 hover:bg-purple-700"
                          >
                            Score This Match
                          </Button>
                        )
                      )}

                      {match.status === 'finished' && (
                        <div className="space-y-2">
                          <div className="text-center py-2 text-sm text-slate-500">
                            Winner: Team {match.winner_team}
                          </div>
                          <Button
                            onClick={async () => {
                              await base44.entities.PuttingKingMatch.update(match.id, {
                                status: 'playing',
                                winner_team: null,
                                finished_at: null
                              });
                              queryClient.invalidateQueries();
                              setActiveScoringMatchId(match.id);
                            }}
                            variant="outline"
                            size="sm"
                            className="w-full"
                          >
                            Edit Score
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-8 text-slate-400">
                      Waiting for players...
                    </div>
                  )}
                </div>
              );
            })}

            {/* Match History */}
            <div className="mt-6">
              <h2 className="text-xl font-bold text-slate-800 mb-3">All Matches</h2>
              <div className="space-y-2">
                {matches
                  .filter(m => m.tournament_id === tournament.id)
                  .sort((a, b) => b.round_number - a.round_number || new Date(b.created_date || 0) - new Date(a.created_date || 0))
                  .map(match => {
                    const station = stations.find(s => s.id === match.station_id);
                    const isWinner = match.winner_team;
                    return (
                      <div key={match.id} className="bg-white rounded-lg p-3 shadow-sm border border-slate-200">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-semibold text-slate-700">
                            {station?.name} - Round {match.round_number}
                          </div>
                          <div className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                            match.status === 'finished' ? 'bg-amber-100 text-amber-700' :
                            match.status === 'playing' ? 'bg-green-100 text-green-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {match.status}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className={`p-2 rounded ${isWinner === 'A' ? 'bg-purple-100' : 'bg-slate-50'}`}>
                            <div className="text-slate-600 mb-0.5">Team A</div>
                            <div className="font-semibold text-slate-700">
                              {match.team_a_players.map(e => getPlayerName(e)).join(', ')}
                            </div>
                            <div className={`text-base font-bold ${isWinner === 'A' ? 'text-purple-600' : 'text-slate-600'}`}>
                              {match.score_a}
                            </div>
                          </div>
                          <div className={`p-2 rounded ${isWinner === 'B' ? 'bg-blue-100' : 'bg-slate-50'}`}>
                            <div className="text-slate-600 mb-0.5">Team B</div>
                            <div className="font-semibold text-slate-700">
                              {match.team_b_players.map(e => getPlayerName(e)).join(', ')}
                            </div>
                            <div className={`text-base font-bold ${isWinner === 'B' ? 'text-blue-600' : 'text-slate-600'}`}>
                              {match.score_b}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

                            {/* Leaderboard Column */}
                            <div className="space-y-6">
                            {/* Leaderboard */}
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                              <h2 className="text-xl font-bold text-slate-800 mb-4">Leaderboard</h2>
                              <div className="space-y-2">
                                {leaderboard.map((player, idx) => (
                                  <div key={player.id} className="flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors rounded-lg">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                                      idx === 0 ? 'bg-yellow-400 text-yellow-900' :
                                      idx === 1 ? 'bg-slate-300 text-slate-700' :
                                      idx === 2 ? 'bg-orange-300 text-orange-800' :
                                      'bg-slate-100 text-slate-600'
                                    }`}>
                                      {idx + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="font-semibold text-slate-800 truncate">{player.user_name}</div>
                                      <div className="text-xs text-slate-500">
                                        {player.wins}W-{player.losses}L • {player.total_attempts > 0 ? ((player.total_made_putts / player.total_attempts) * 100).toFixed(0) : 0}%
                                      </div>
                                    </div>
                                    <div className="text-lg font-bold text-purple-600 flex-shrink-0">{player.tournament_points}</div>
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