import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Trophy, Play, Plus, Trash2, Users } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import PuttingKingScoreInput from '@/components/putting/PuttingKingScoreInput';
import SuddenDeathDialog from '@/components/putting/SuddenDeathDialog';
import PuttingKingRules from '@/components/putting/PuttingKingRules';
import TournamentRulesDialog from '@/components/putting/TournamentRulesDialog';
import LoadingState from '@/components/ui/loading-state';

export default function PuttingKingOverview() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tournamentId = searchParams.get('id');
  const queryClient = useQueryClient();
  const [activeScoringMatchId, setActiveScoringMatchId] = useState(null);
  const [suddenDeathMatch, setSuddenDeathMatch] = useState(null);
  const [newPlayerEmail, setNewPlayerEmail] = useState('');
  const [showRulesDialog, setShowRulesDialog] = useState(false);

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

  const userRole = user?.app_role || 'user';
  const isHost = tournament?.host_user === user?.email;
  const canManage = ['trainer', 'admin', 'super_admin'].includes(userRole) || isHost;

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
  const canStartNextRound = allMatchesFinished;
  const isTournamentFinished = tournament?.status === 'finished';
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

  const addPlayerMutation = useMutation({
    mutationFn: async (emailOrName) => {
      const trimmed = emailOrName.trim();
      let email = trimmed;
      let displayName = trimmed;

      // If it's an email, try to find the user
      if (trimmed.includes('@')) {
        email = trimmed;
        try {
          const allUsers = await base44.entities.User.list();
          const foundUser = allUsers.find(u => u.email === email);
          if (foundUser) {
            displayName = foundUser.display_name || foundUser.full_name;
          } else {
            displayName = trimmed.split('@')[0];
          }
        } catch {
          displayName = trimmed.split('@')[0];
        }
      } else {
        // Just a name, create temp email
        email = `${trimmed}@temp.local`;
        displayName = trimmed;
      }

      return await base44.entities.PuttingKingPlayer.create({
        tournament_id: tournament.id,
        user_email: email,
        user_name: displayName,
        active: true,
        tournament_points: 0,
        wins: 0,
        losses: 0,
        total_made_putts: 0,
        total_attempts: 0,
        stats_by_distance: {}
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      setNewPlayerEmail('');
      toast.success('Player added!');
    }
  });

  const removePlayerMutation = useMutation({
    mutationFn: (playerId) => base44.entities.PuttingKingPlayer.delete(playerId),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success('Player removed');
    }
  });

  const minPlayersRequired = stations.length * 4;

  const startTournamentMutation = useMutation({
    mutationFn: async () => {
      // Get all stations
      const allStations = await base44.entities.PuttingKingStation.list();
      const tournamentStations = allStations.filter(s => s.tournament_id === tournament.id && s.enabled)
        .sort((a, b) => a.order_index - b.order_index);

      // Get all players
      const allPlayers = await base44.entities.PuttingKingPlayer.list();
      const tournamentPlayers = allPlayers
        .filter(p => p.tournament_id === tournament.id && p.active)
        .sort(() => Math.random() - 0.5); // Shuffle

      const minRequired = tournamentStations.length * 4;
      if (tournamentPlayers.length < minRequired) {
        throw new Error(`Need at least ${minRequired} players (${tournamentStations.length} stations × 4 players)`);
      }

      const playersPerStation = 4;
      
      // Create first round matches
      for (let i = 0; i < tournamentStations.length && i * playersPerStation < tournamentPlayers.length; i++) {
        const station = tournamentStations[i];
        const stationPlayers = tournamentPlayers.slice(i * playersPerStation, (i + 1) * playersPerStation);

        if (stationPlayers.length === 4) {
          const [p1, p2, p3, p4] = stationPlayers;
          const teamA = [p1.user_email, p2.user_email];
          const teamB = [p3.user_email, p4.user_email];

          const match = await base44.entities.PuttingKingMatch.create({
            tournament_id: tournament.id,
            station_id: station.id,
            round_number: 1,
            status: 'ready',
            team_a_players: teamA,
            team_b_players: teamB,
            score_a: 0,
            score_b: 0
          });

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

      await base44.entities.PuttingKingTournament.update(tournament.id, { 
        status: 'active'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success('Tournament started!');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to start tournament');
    }
  });

  const startNextRoundMutation = useMutation({
    mutationFn: async () => {
      const nextRound = tournament.current_round + 1;
      
      // Get all stations sorted by order
      const allStations = await base44.entities.PuttingKingStation.list();
      const tournamentStations = allStations.filter(s => s.tournament_id === tournament.id && s.enabled)
        .sort((a, b) => a.order_index - b.order_index);

      // Get current round matches
      const currentRoundMatches = matches.filter(m => m.round_number === tournament.current_round && m.status === 'finished');
      
      // For each match, determine new station and split teams
      const newMatches = [];
      
      for (const match of currentRoundMatches) {
        const station = tournamentStations.find(s => s.id === match.station_id);
        if (!station) continue;
        
        const currentStationIndex = tournamentStations.indexOf(station);
        
        // Determine winners and losers
        const winnersTeam = match.winner_team === 'A' ? match.team_a_players : match.team_b_players;
        const losersTeam = match.winner_team === 'A' ? match.team_b_players : match.team_a_players;
        
        // Winners move up (lower index = higher basket), losers move down
        const winnerStationIndex = Math.max(0, currentStationIndex - 1);
        const loserStationIndex = Math.min(tournamentStations.length - 1, currentStationIndex + 1);
        
        // Split teams: previous teammates become opponents
        // Winners split
        newMatches.push({
          station_id: tournamentStations[winnerStationIndex].id,
          players: winnersTeam,
          was_winner: true
        });
        
        // Losers split
        newMatches.push({
          station_id: tournamentStations[loserStationIndex].id,
          players: losersTeam,
          was_winner: false
        });
      }
      
      // Group by station
      const stationGroups = {};
      newMatches.forEach(m => {
        if (!stationGroups[m.station_id]) {
          stationGroups[m.station_id] = [];
        }
        stationGroups[m.station_id].push(m);
      });
      
      // Create matches for each station (2 groups = 4 players)
      for (const stationId in stationGroups) {
        const groups = stationGroups[stationId];
        
        if (groups.length === 2) {
          const [group1, group2] = groups;
          
          // Split: take one from each previous team to form new teams
          const teamA = [group1.players[0], group2.players[0]];
          const teamB = [group1.players[1], group2.players[1]];
          
          const match = await base44.entities.PuttingKingMatch.create({
            tournament_id: tournament.id,
            station_id: stationId,
            round_number: nextRound,
            status: 'ready',
            team_a_players: teamA,
            team_b_players: teamB,
            score_a: 0,
            score_b: 0
          });
          
          // Update all 4 players
          const allMatchPlayers = [...teamA, ...teamB];
          for (const email of allMatchPlayers) {
            const player = players.find(p => p.user_email === email);
            if (player) {
              const partner = teamA.includes(email) 
                ? teamA.find(e => e !== email)
                : teamB.find(e => e !== email);
              
              await base44.entities.PuttingKingPlayer.update(player.id, {
                current_status: 'ready',
                current_station_id: stationId,
                current_match_id: match.id,
                last_partner_email: partner
              });
            }
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

    const finishTournamentMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.PuttingKingTournament.update(tournament.id, {
        status: 'finished'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success('Tournament finished!');
    }
    });

  if (!tournament) {
    return <LoadingState />;
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
      {showRulesDialog && (
        <TournamentRulesDialog onClose={() => setShowRulesDialog(false)} />
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
              Round {tournament.current_round}
            </div>
          </div>

          {/* Tournament Status Actions */}
          {tournament.status === 'setup' ? (
            <div className="flex flex-col items-center gap-3">
              <div className="px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                Setup Mode - Add players to start
              </div>
              {canManage && (
                <Button
                  onClick={() => startTournamentMutation.mutate()}
                  disabled={startTournamentMutation.isPending || players.length < minPlayersRequired}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Play className="w-4 h-4 mr-2" />
                  {players.length < minPlayersRequired ? `Start Tournament (${players.length}/${minPlayersRequired} players)` : 'Start Tournament'}
                </Button>
              )}
            </div>
          ) : canManage && allMatchesFinished && (
            <div className="flex flex-col items-center gap-2">
              {canStartNextRound && !isTournamentFinished && (
                <Button
                  onClick={() => startNextRoundMutation.mutate()}
                  disabled={startNextRoundMutation.isPending}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start Round {tournament.current_round + 1}
                </Button>
              )}
              {!isTournamentFinished && tournament.status === 'active' && (
                <Button
                  onClick={() => finishTournamentMutation.mutate()}
                  disabled={finishTournamentMutation.isPending}
                  variant="destructive"
                  className="mt-2"
                >
                  <Trophy className="w-4 h-4 mr-2" />
                  Finish Tournament
                </Button>
              )}
              {isTournamentFinished && (
                <div className="px-4 py-2 bg-amber-100 text-amber-700 rounded-full text-sm font-semibold">
                  Tournament Complete!
                </div>
              )}
            </div>
          )}
          
          {/* PIN Display */}
          <div className="flex items-center justify-center gap-2 mt-4">
            <div className="text-sm text-slate-500">Tournament PIN:</div>
            <div className="px-4 py-2 bg-purple-100 rounded-lg">
              <div className="text-xl font-bold text-purple-700 tracking-wider">{tournament.pin}</div>
            </div>
            <Button
              onClick={() => {
                navigator.clipboard.writeText(tournament.pin);
                toast.success('PIN copied!');
              }}
              variant="outline"
              size="sm"
            >
              Copy
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Stations and Scoring */}
          <div className="lg:col-span-2 space-y-4">
            {tournament.status === 'setup' ? (
              <>
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                  <h2 className="text-xl font-bold text-slate-800 mb-4">Tournament Setup</h2>
                  <p className="text-slate-600 mb-4">
                    Share the PIN with players to join, or add them manually below. 
                    You need at least {minPlayersRequired} players ({stations.length} station{stations.length > 1 ? 's' : ''} × 4 players) to start the tournament.
                  </p>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-5 h-5 text-blue-600" />
                      <span className="font-semibold text-blue-800">Players: {players.length}</span>
                    </div>
                    <div className="text-sm text-blue-600">
                      {players.length < minPlayersRequired ? `Need ${minPlayersRequired - players.length} more player${minPlayersRequired - players.length > 1 ? 's' : ''}` : 'Ready to start!'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between mb-4">
                  <div></div>
                  <Button
                    onClick={() => setShowRulesDialog(true)}
                    variant="outline"
                    size="sm"
                  >
                    Muuda Reegleid
                  </Button>
                </div>
                <PuttingKingRules tournament={tournament} />
              </>
            ) : (
              <>
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
                            canManage={canManage}
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
                          {canManage && (
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
                          )}
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
            {tournament.status !== 'setup' && (
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
            )}
              </>
            )}
          </div>

          {/* Players Column */}
          <div className="space-y-6">
            {/* Add Player (Host Only) */}
            {canManage && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <h2 className="text-xl font-bold text-slate-800 mb-4">Add Player</h2>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={newPlayerEmail}
                    onChange={(e) => setNewPlayerEmail(e.target.value)}
                    placeholder="Email or name"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && newPlayerEmail.trim()) {
                        addPlayerMutation.mutate(newPlayerEmail);
                      }
                    }}
                  />
                  <Button
                    onClick={() => addPlayerMutation.mutate(newPlayerEmail)}
                    disabled={!newPlayerEmail.trim() || addPlayerMutation.isPending}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-slate-500">Add players by email or name</p>
              </div>
            )}

            {/* Players List */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <h2 className="text-xl font-bold text-slate-800 mb-4">
                Players ({players.length})
              </h2>
              <div className="space-y-2">
                {players.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No players yet</p>
                  </div>
                ) : (
                  players.map((player) => {
                    const isCurrentUser = player.user_email === user?.email;
                    const canRemove = (canManage || isCurrentUser) && tournament.status === 'setup';
                    
                    return (
                      <div key={player.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg">
                        <div className="flex-1">
                          <div className="font-semibold text-slate-800">
                            {player.user_name}
                            {isCurrentUser && <span className="ml-2 text-xs text-emerald-600">(You)</span>}
                          </div>
                          {tournament.status !== 'setup' && (
                            <div className="text-xs text-slate-500">
                              {player.wins}W-{player.losses}L • {player.tournament_points} pts
                            </div>
                          )}
                        </div>
                        {canRemove && (
                          <Button
                            onClick={() => removePlayerMutation.mutate(player.id)}
                            variant="ghost"
                            size="icon"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Leaderboard (Active Tournament) */}
            {tournament.status !== 'setup' && (
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
                                )}
                                </div>
                                </div>
                                </div>
              </div>
              );
              }
