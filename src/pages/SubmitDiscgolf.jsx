import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import BackButton from '@/components/ui/back-button';

export default function SubmitDiscgolf() {
  const queryClient = useQueryClient();
  
  const [playerEmail, setPlayerEmail] = useState('');
  const [gameType, setGameType] = useState('classic');
  const [score, setScore] = useState('');
  const [madePutts, setMadePutts] = useState('');
  const [totalPutts, setTotalPutts] = useState('');
  const [gender, setGender] = useState('M');

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => base44.entities.User.list()
  });
  const selectableUsers = React.useMemo(
    () => allUsers.filter((entry) => !entry.merged_into),
    [allUsers]
  );

  const submitMutation = useMutation({
    mutationFn: async () => {
      const selectedUser = selectableUsers.find(u => u.email === playerEmail);
      const accuracy = parseInt(totalPutts) > 0 ? (parseInt(madePutts) / parseInt(totalPutts)) * 100 : 0;

      return await base44.entities.LeaderboardEntry.create({
        game_id: 'discgolf-submission',
        player_uid: selectedUser?.id,
        player_email: playerEmail,
        player_name: selectedUser?.full_name || playerEmail,
        game_type: gameType,
        score: parseInt(score),
        accuracy: Math.round(accuracy * 10) / 10,
        made_putts: parseInt(madePutts),
        total_putts: parseInt(totalPutts),
        leaderboard_type: 'discgolf_ee',
        submitted_by: user?.email,
        player_gender: gender,
        date: new Date().toISOString()
      });
    },
    onSuccess: () => {
      toast.success('Tulemus saadetud Discgolf.ee edetabelisse!');
      setPlayerEmail('');
      setScore('');
      setMadePutts('');
      setTotalPutts('');
      setGameType('classic');
      setGender('M');
      queryClient.invalidateQueries({ queryKey: ['leaderboard-entries'] });
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!playerEmail || !score || !madePutts || !totalPutts) {
      toast.error('Täida kõik väljad');
      return;
    }
    submitMutation.mutate();
  };

  const userRole = user?.app_role || 'user';
  const canSubmit = ['trainer', 'admin', 'super_admin'].includes(userRole);

  if (!canSubmit) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-red-50 to-white flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Ligipääs keelatud</h1>
          <p className="text-slate-600 mb-6">Tulemuste sisestamiseks on vaja treeneri õigusi.</p>
          <BackButton className="mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-2xl mx-auto p-4">
        <div className="flex items-center justify-between mb-6 pt-4">
          <BackButton />
          <div className="w-16" />
        </div>

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Upload className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Saada Discgolf.ee-sse</h1>
          <p className="text-slate-600">Sisesta mängijate tulemused treeningtabelisse</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Mängija e-post</label>
            <Select value={playerEmail} onValueChange={setPlayerEmail}>
              <SelectTrigger>
                <SelectValue placeholder="Vali mängija" />
              </SelectTrigger>
              <SelectContent>
                {selectableUsers.map(u => (
                  <SelectItem key={u.id} value={u.email}>
                    {u.full_name} ({u.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Mängu formaat</label>
            <Select value={gameType} onValueChange={setGameType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="classic">Classic</SelectItem>
                <SelectItem value="back_and_forth">Back &amp; Forth</SelectItem>
                <SelectItem value="short">Short</SelectItem>
                <SelectItem value="long">Long</SelectItem>
                <SelectItem value="streak_challenge">Seeria</SelectItem>
                <SelectItem value="random_distance">Juhuslik distants</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Sugu</label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="M">Mees</SelectItem>
                <SelectItem value="N">Naine</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Skoor</label>
            <Input
              type="number"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              placeholder="Koguskoor"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Sees putid</label>
              <Input
                type="number"
                value={madePutts}
                onChange={(e) => setMadePutts(e.target.value)}
                placeholder="0"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Putte kokku</label>
              <Input
                type="number"
                value={totalPutts}
                onChange={(e) => setTotalPutts(e.target.value)}
                placeholder="0"
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={submitMutation.isPending}
            className="w-full h-12 bg-blue-600 hover:bg-blue-700"
          >
            <Upload className="w-5 h-5 mr-2" />
            Saada Discgolf.ee tabelisse
          </Button>
        </form>
      </div>
    </div>
  );
}
