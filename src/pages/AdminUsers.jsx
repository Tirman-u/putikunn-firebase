import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Shield, UserCog } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import LoadingState from '@/components/ui/loading-state';

export default function AdminUsers() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isLoadingAuth } = useAuth();

  const { data: currentUserData, isLoading: currentUserLoading } = useQuery({
    queryKey: ['userProfile', user?.uid],
    queryFn: async () => {
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);
      return userDocSnap.exists() ? { id: userDocSnap.id, ...userDocSnap.data() } : null;
    },
    enabled: !!user,
  });

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['all-users'],
    queryFn: async () => {
        const usersCollection = collection(db, "users");
        const usersSnapshot = await getDocs(usersCollection);
        return usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }) => {
      const userDocRef = doc(db, "users", userId);
      await updateDoc(userDocRef, { app_role: newRole });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      toast.success('Kasutaja roll uuendatud');
    }
  });

  const makeCurrentUserSuperAdmin = useMutation({
    mutationFn: async () => {
        if(!user) return;
        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, { app_role: 'super_admin' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile', user?.uid] });
      toast.success('Sa oled nüüd superadmin!');
    }
  });

  if (isLoadingAuth || currentUserLoading || usersLoading) {
      return <LoadingState />
  }

  const isSuperAdmin = currentUserData?.app_role === 'super_admin';

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
          {/* Role descriptions... */}

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
                {users.map(u => (
                  <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-2 font-medium text-slate-700">{u.displayName || u.email}</td>
                    <td className="py-3 px-2 text-slate-600">{u.email}</td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${roleColors[u.app_role] || roleColors.user}`}>
                        {roleLabels[u.app_role] || 'Kasutaja'}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      <Select
                        value={u.app_role || 'user'}
                        onValueChange={(newRole) => updateRoleMutation.mutate({ userId: u.id, newRole })}
                        disabled={u.id === currentUserData?.id}
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
