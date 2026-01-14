import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { X, Send, UserPlus } from 'lucide-react';

export default function InviteFriendsDialog({ game, isOpen, onClose }) {
  const [email, setEmail] = useState('');
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const sendInvitationMutation = useMutation({
    mutationFn: async (inviteData) => {
      return await base44.entities.GameInvitation.create(inviteData);
    },
    onSuccess: () => {
      setEmail('');
      alert('Invitation sent!');
    }
  });

  const handleSendInvitation = () => {
    if (!email.trim()) {
      alert('Please enter an email address');
      return;
    }

    if (email === user?.email) {
      alert('You cannot invite yourself');
      return;
    }

    sendInvitationMutation.mutate({
      game_id: game.id,
      game_name: game.name,
      from_user_email: user.email,
      from_user_name: user.full_name,
      to_user_email: email.trim(),
      status: 'pending',
      sent_date: new Date().toISOString()
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Friends to {game.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-slate-600 mb-2 block">Friend's Email</label>
            <Input
              type="email"
              placeholder="friend@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendInvitation()}
            />
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={handleSendInvitation} 
              disabled={sendInvitationMutation.isPending}
              className="flex-1"
            >
              <Send className="w-4 h-4 mr-2" />
              Send Invitation
            </Button>
            <Button onClick={onClose} variant="outline">
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}