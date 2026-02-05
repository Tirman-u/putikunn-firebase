import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Shield, UserCog } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function AdminUsers() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => base44.auth.me()
  });

  const { data: users = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => base44.entities.User.list()
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }) => {
      await base44.entities.User.update(userId, { app_role: newRole });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      toast.success('Kasutaja roll uuendatud');
    }
  });

  const makeCurrentUserSuperAdmin = useMutation({
    mutationFn: async () => {
      await base44.auth.updateMe({ app_role: 'super_admin' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-user'] });
      toast.success('Sa oled nüüd superadmin!');
    }
  });

  const isSuperAdmin = currentUser?.app_role === 'super_admin';

  if (!isSuperAdmin) {
    const hasSuperAdmin = users.some(u => u.app_role === 'super_admin');
    
    return (
      <div className="min-h-screen bg-gradient-to-b from-red-50 to-white flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-800 mb-2">
            {hasSuperAdmin ? 'Ligipääs keelatud' : 'Esmane seadistus'}
          </h1>
          <p className="text-slate-600 mb-6">
            {hasSuperAdmin 
              ? 'Sellele lehele pääseb ainult superadmin.'
              : 'Superadmini pole veel. Vajuta all, et saada esimeseks superadminiks.'
            }
          </p>
          {!hasSuperAdmin ? (
            <div className="space-y-3">
              <Button 
                onClick={() => makeCurrentUserSuperAdmin.mutate()}
                disabled={makeCurrentUserSuperAdmin.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                Tee mind superadminiks
              </Button>
              <Button onClick={() => navigate(-1)} variant="outline">Tühista</Button>
            </div>
          ) : (
            <Button onClick={() => navigate(-1)}>Tagasi</Button>
          )}
        </div>
      </div>
    );
  }

  const roleColors = {
    user: 'bg-slate-100 text-slate-700',
    trainer: 'bg-blue-100 text-blue-700',
    admin: 'bg-purple-100 text-purple-700',
    super_admin: 'bg-red-100 text-red-700'
  };

  const roleLabels = {
    user: 'Kasutaja',
    trainer: 'Treener',
    admin: 'Admin',
    super_admin: 'Superadmin'
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <div className="max-w-5xl mx-auto p-4">
        <div className="flex items-center justify-between mb-6 pt-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-800"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Tagasi</span>
          </button>
          <div className="flex items-center gap-2">
            <UserCog className="w-6 h-6 text-slate-700" />
            <h1 className="text-2xl font-bold text-slate-800">Kasutajate haldus</h1>
          </div>
          <div className="w-16" />
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-800 mb-2">Rollide kirjeldused</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-slate-50 rounded-lg">
                <div className="font-semibold text-slate-700 mb-1">👤 Kasutaja</div>
                <div className="text-slate-600">Liitu mängudega, soolotreening, vaata profiili</div>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="font-semibold text-blue-700 mb-1">🎓 Treener</div>
                <div className="text-slate-600">+ Hosti mänge, saada Discgolf.ee edetabelisse</div>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <div className="font-semibold text-purple-700 mb-1">🛡️ Admin</div>
                <div className="text-slate-600">+ Halda mänge, kustuta sisu, Putting King ligipääs</div>
              </div>
              <div className="p-3 bg-red-50 rounded-lg">
                <div className="font-semibold text-red-700 mb-1">👑 Superadmin</div>
                <div className="text-slate-600">+ Halda kasutajarolle ja õigusi</div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left py-3 px-2 text-slate-600 font-semibold">Nimi</th>
                  <th className="text-left py-3 px-2 text-slate-600 font-semibold">E-post</th>
                  <th className="text-left py-3 px-2 text-slate-600 font-semibold">Praegune roll</th>
                  <th className="text-left py-3 px-2 text-slate-600 font-semibold">Muuda rolli</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-2 font-medium text-slate-700">{user.full_name}</td>
                    <td className="py-3 px-2 text-slate-600">{user.email}</td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${roleColors[user.app_role] || roleColors.user}`}>
                        {roleLabels[user.app_role] || 'Kasutaja'}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      <Select
                        value={user.app_role || 'user'}
                        onValueChange={(newRole) => updateRoleMutation.mutate({ userId: user.id, newRole })}
                        disabled={user.id === currentUser.id}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">Kasutaja</SelectItem>
                          <SelectItem value="trainer">Treener</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="super_admin">Superadmin</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
