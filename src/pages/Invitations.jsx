import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Mail, Check, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format as formatDate } from 'date-fns';

export default function Invitations() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: invitations = [], isLoading } = useQuery({
    queryKey: ['invitations', user?.email],
    queryFn: async () => {
      const allInvitations = await base44.entities.GameInvitation.list();
      return allInvitations.filter(inv => 
        inv.to_user_email === user.email && inv.status === 'pending'
      ).sort((a, b) => new Date(b.sent_date) - new Date(a.sent_date));
    },
    enabled: !!user
  });

  const respondToInvitationMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      await base44.entities.GameInvitation.update(id, { status });
      
      if (status === 'accepted') {
        // Get the game and add player
        const games = await base44.entities.Game.list();
        const game = games.find(g => g.id === id);
        
        if (game && !game.players.includes(user.full_name)) {
          const updatedPlayers = [...game.players, user.full_name];
          const updatedDistances = { ...game.player_distances, [user.full_name]: game.player_distances[game.players[0]] };
          const updatedPutts = { ...game.player_putts, [user.full_name]: [] };
          const updatedPoints = { ...game.total_points, [user.full_name]: 0 };
          
          await base44.entities.Game.update(game.id, {
            players: updatedPlayers,
            player_distances: updatedDistances,
            player_putts: updatedPutts,
            total_points: updatedPoints
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
    }
  });

  const handleAccept = (invitation) => {
    respondToInvitationMutation.mutate({ 
      id: invitation.id, 
      status: 'accepted' 
    });
  };

  const handleDecline = (invitation) => {
    respondToInvitationMutation.mutate({ 
      id: invitation.id, 
      status: 'declined' 
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <div className="max-w-2xl mx-auto p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pt-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-800"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back</span>
          </button>
          <h1 className="text-2xl font-bold text-slate-800">Invitations</h1>
          <div className="w-16" />
        </div>

        {invitations.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 shadow-sm border border-slate-100 text-center">
            <Mail className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 text-lg">No pending invitations</p>
          </div>
        ) : (
          <div className="space-y-3">
            {invitations.map(invitation => (
              <div key={invitation.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-bold text-lg text-slate-800">{invitation.game_name}</div>
                    <div className="text-sm text-slate-500">
                      From <span className="font-medium">{invitation.from_user_name}</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {formatDate(new Date(invitation.sent_date), 'MMM d, yyyy h:mm a')}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleAccept(invitation)}
                    disabled={respondToInvitationMutation.isPending}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Accept
                  </Button>
                  <Button
                    onClick={() => handleDecline(invitation)}
                    disabled={respondToInvitationMutation.isPending}
                    variant="outline"
                    className="flex-1"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}