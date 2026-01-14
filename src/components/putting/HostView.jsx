import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Copy, Check, Users, UserPlus } from 'lucide-react';
import JylyScoreTable from './JylyScoreTable';
import InviteFriendsDialog from '../invitations/InviteFriendsDialog';

const MAX_ROUNDS = 20;

export default function HostView({ gameId, onExit }) {
  const [copied, setCopied] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);

  const { data: game, isLoading } = useQuery({
    queryKey: ['game', gameId],
    queryFn: () => base44.entities.Game.list().then(games => games.find(g => g.id === gameId)),
    refetchInterval: 2000 // Poll every 2 seconds for updates
  });

  const copyPin = () => {
    if (game?.pin) {
      navigator.clipboard.writeText(game.pin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading || !game) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  const maxRoundReached = game.players.some(player => 
    (game.round_scores?.[player]?.length || 0) >= MAX_ROUNDS
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <div className="max-w-6xl mx-auto p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pt-4">
          <button
            onClick={onExit}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-800"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Exit</span>
          </button>
          <h2 className="text-xl font-bold text-slate-800">{game.name}</h2>
          <div className="w-16" />
        </div>

        {/* PIN Display */}
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 shadow-lg mb-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold mb-1 opacity-90">Game PIN</div>
              <div className="text-4xl font-bold tracking-widest">{game.pin}</div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-2">
                <Button
                  onClick={copyPin}
                  size="sm"
                  className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                >
                  {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
                <Button
                  onClick={() => setShowInviteDialog(true)}
                  size="sm"
                  className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                >
                  <UserPlus className="w-4 h-4 mr-1" />
                  Invite
                </Button>
              </div>
              <div className="flex items-center gap-2 text-sm opacity-90">
                <Users className="w-4 h-4" />
                <span>{game.players.length} players</span>
              </div>
            </div>
          </div>
        </div>

        {/* Round Progress */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-6">
          <div className="text-center">
            <span className="text-sm text-slate-500">Game Progress</span>
            <div className="text-2xl font-bold text-emerald-600 mt-1">
              Max {Math.max(...game.players.map(p => game.round_scores?.[p]?.length || 0), 0)} / {MAX_ROUNDS} rounds
            </div>
          </div>
          {maxRoundReached && (
            <div className="mt-3 p-3 bg-amber-50 rounded-xl text-center text-amber-700 text-sm font-medium">
              🏁 At least one player has completed all 20 rounds!
            </div>
          )}
        </div>

        {/* Master Scoreboard */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {game.players.length > 0 ? (
            <JylyScoreTable 
              players={game.players}
              roundScores={game.round_scores}
              totalPoints={game.total_points}
              playerDistances={game.player_distances}
              currentRound={Math.max(...game.players.map(p => (game.round_scores?.[p]?.length || 0) + 1))}
            />
          ) : (
            <div className="p-12 text-center text-slate-400">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Waiting for players to join...</p>
              <p className="text-sm mt-2">Share the PIN: <span className="font-bold text-emerald-600">{game.pin}</span></p>
            </div>
          )}
        </div>
      </div>

      {/* Invite Dialog */}
      {showInviteDialog && (
        <InviteFriendsDialog 
          game={game}
          isOpen={showInviteDialog}
          onClose={() => setShowInviteDialog(false)}
        />
      )}
    </div>
  );
}