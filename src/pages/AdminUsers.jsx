import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Activity, CalendarClock, Gamepad2, Shield, UserCog, Users, Wrench } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'sonner';
import BackButton from '@/components/ui/back-button';
import HomeButton from '@/components/ui/home-button';
import { createPageUrl } from '@/utils';

const ACTIVITY_WINDOW_DAYS = 30;
const ACTIVITY_WINDOW_MS = ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000;

const roleLabels = {
  user: 'Kasutaja',
  trainer: 'Treener',
  admin: 'Admin',
  super_admin: 'Superadmin'
};

const roleColors = {
  user: 'bg-slate-100 text-slate-700 dark:bg-black dark:text-slate-100 dark:border dark:border-white/10',
  trainer: 'bg-blue-100 text-blue-700 dark:bg-black dark:text-blue-300 dark:border dark:border-blue-300/40',
  admin: 'bg-purple-100 text-purple-700 dark:bg-black dark:text-purple-300 dark:border dark:border-purple-300/40',
  super_admin: 'bg-red-100 text-red-700 dark:bg-black dark:text-red-300 dark:border dark:border-red-300/40'
};

const normalizeEmail = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : 0;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value === 'object' && typeof value.seconds === 'number') {
    return value.seconds * 1000;
  }
  return 0;
};

const formatActivityTime = (millis) => {
  if (!millis) return '-';
  try {
    return format(new Date(millis), 'MMM d, yyyy HH:mm');
  } catch {
    return '-';
  }
};

const fetchEntityRows = async (entityApi, { filter = {}, sort = '-created_date', maxRows = 1000 } = {}) => {
  const rows = [];
  const batchSize = 200;

  while (rows.length < maxRows) {
    const chunk = await entityApi.filter(filter, sort, batchSize, rows.length);
    if (!chunk?.length) break;
    rows.push(...chunk);
    if (chunk.length < batchSize) break;
  }

  return rows;
};

export default function AdminUsers() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = React.useState('overview');
  const [searchValue, setSearchValue] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState('all');
  const [activityFilter, setActivityFilter] = React.useState('all');

  const { data: currentUser } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: users = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => base44.entities.User.list()
  });

  const { data: hostedGames = [] } = useQuery({
    queryKey: ['admin-dashboard-games'],
    queryFn: async () => fetchEntityRows(base44.entities.Game, {
      filter: { pin: { $ne: '0000' } },
      sort: '-date',
      maxRows: 800
    }),
    enabled: Boolean(currentUser)
  });

  const { data: duelGames = [] } = useQuery({
    queryKey: ['admin-dashboard-duel-games'],
    queryFn: async () => fetchEntityRows(base44.entities.DuelGame, {
      filter: {},
      sort: '-created_at',
      maxRows: 800
    }),
    enabled: Boolean(currentUser)
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }) => {
      await base44.entities.User.update(userId, { app_role: newRole });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      toast.success('Kasutaja roll uuendatud');
    },
    onError: (error) => {
      toast.error(error?.message || 'Rolli uuendamine ebaõnnestus');
    }
  });

  const makeCurrentUserSuperAdmin = useMutation({
    mutationFn: async () => {
      await base44.auth.updateMe({ app_role: 'super_admin' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
      toast.success('Sa oled nüüd superadmin!');
    }
  });

  const visibleUsers = React.useMemo(
    () => users.filter((entry) => !entry.merged_into),
    [users]
  );

  const isSuperAdmin = currentUser?.app_role === 'super_admin';

  const activityCutoffTs = React.useMemo(() => Date.now() - ACTIVITY_WINDOW_MS, []);

  const userActivityByUid = React.useMemo(() => {
    const byUid = new Map();
    const byEmail = new Map();

    const registerActivity = ({ uid, email, timestamp }) => {
      const ts = Number(timestamp) || 0;
      if (!ts) return;
      if (uid) {
        const prev = byUid.get(uid) || 0;
        if (ts > prev) byUid.set(uid, ts);
      }
      const normalizedEmail = normalizeEmail(email);
      if (normalizedEmail) {
        const prev = byEmail.get(normalizedEmail) || 0;
        if (ts > prev) byEmail.set(normalizedEmail, ts);
      }
    };

    visibleUsers.forEach((entry) => {
      const baseTs = Math.max(
        toMillis(entry?.updated_date),
        toMillis(entry?.created_date),
        toMillis(entry?.last_login_at),
        toMillis(entry?.last_seen_at)
      );
      registerActivity({ uid: entry.id, email: entry.email, timestamp: baseTs });
    });

    hostedGames.forEach((game) => {
      const gameTs = Math.max(
        toMillis(game?.updated_date),
        toMillis(game?.date),
        toMillis(game?.created_date)
      );
      registerActivity({ email: game?.host_user, timestamp: gameTs });

      Object.values(game?.player_uids || {}).forEach((uid) => {
        registerActivity({ uid, timestamp: gameTs });
      });

      Object.values(game?.player_emails || {}).forEach((email) => {
        registerActivity({ email, timestamp: gameTs });
      });
    });

    duelGames.forEach((game) => {
      const duelTs = Math.max(
        toMillis(game?.updated_date),
        toMillis(game?.created_at),
        toMillis(game?.started_at),
        toMillis(game?.ended_at),
        toMillis(game?.created_date)
      );

      registerActivity({ email: game?.host_user, timestamp: duelTs });
      (game?.participant_uids || []).forEach((uid) => registerActivity({ uid, timestamp: duelTs }));
      (game?.participant_emails || []).forEach((email) => registerActivity({ email, timestamp: duelTs }));

      Object.values(game?.state?.players || {}).forEach((player) => {
        registerActivity({ uid: player?.id, email: player?.email, timestamp: duelTs });
      });
    });

    return { byUid, byEmail };
  }, [visibleUsers, hostedGames, duelGames]);

  const usersWithMeta = React.useMemo(() => {
    return visibleUsers
      .map((entry) => {
        const byUidTs = userActivityByUid.byUid.get(entry.id) || 0;
        const byEmailTs = userActivityByUid.byEmail.get(normalizeEmail(entry.email)) || 0;
        const lastActivityTs = Math.max(byUidTs, byEmailTs);
        const isActive = lastActivityTs >= activityCutoffTs;

        return {
          ...entry,
          lastActivityTs,
          isActive
        };
      })
      .sort((a, b) => b.lastActivityTs - a.lastActivityTs);
  }, [visibleUsers, userActivityByUid, activityCutoffTs]);

  const filteredUsers = React.useMemo(() => {
    const needle = searchValue.trim().toLowerCase();

    return usersWithMeta.filter((entry) => {
      if (roleFilter !== 'all' && (entry.app_role || 'user') !== roleFilter) return false;
      if (activityFilter === 'active' && !entry.isActive) return false;
      if (activityFilter === 'inactive' && entry.isActive) return false;

      if (!needle) return true;
      const name = String(entry.full_name || entry.display_name || entry.displayName || '').toLowerCase();
      const email = String(entry.email || '').toLowerCase();
      return name.includes(needle) || email.includes(needle);
    });
  }, [usersWithMeta, searchValue, roleFilter, activityFilter]);

  const totalUsers = usersWithMeta.length;
  const activeUsersCount = usersWithMeta.filter((entry) => entry.isActive).length;

  const roleStats = React.useMemo(() => {
    const counts = {
      user: 0,
      trainer: 0,
      admin: 0,
      super_admin: 0
    };
    usersWithMeta.forEach((entry) => {
      const role = entry.app_role || 'user';
      if (counts[role] === undefined) {
        counts.user += 1;
      } else {
        counts[role] += 1;
      }
    });
    return counts;
  }, [usersWithMeta]);

  const activeHostedGames = React.useMemo(
    () => hostedGames.filter((game) => {
      const status = String(game?.status || '').toLowerCase();
      return Boolean(
        game?.pin &&
        game.pin !== '0000' &&
        game.join_closed !== true &&
        status !== 'closed' &&
        status !== 'completed' &&
        status !== 'finished'
      );
    }),
    [hostedGames]
  );

  const activeDuelGames = React.useMemo(
    () => duelGames.filter((game) => {
      const status = String(game?.status || '').toLowerCase();
      return Boolean(
        game?.pin &&
        game.pin !== '0000' &&
        status !== 'finished' &&
        status !== 'closed' &&
        status !== 'cancelled'
      );
    }),
    [duelGames]
  );

  const recentJoinableEntries = React.useMemo(() => {
    const regularEntries = activeHostedGames.map((game) => ({
      id: game.id,
      name: game.name || 'Mäng',
      pin: game.pin,
      kind: 'regular',
      status: game.status,
      date: toMillis(game?.date || game?.created_date)
    }));

    const duelEntries = activeDuelGames.map((game) => ({
      id: game.id,
      name: game.name || (game.mode === 'solo' ? 'SOLO duell' : 'HOST duell'),
      pin: game.pin,
      kind: 'duel',
      status: game.status,
      date: toMillis(game?.created_at || game?.started_at || game?.created_date)
    }));

    return [...regularEntries, ...duelEntries]
      .sort((a, b) => b.date - a.date)
      .slice(0, 8);
  }, [activeHostedGames, activeDuelGames]);

  if (!isSuperAdmin) {
    const hasSuperAdmin = visibleUsers.some((entry) => entry.app_role === 'super_admin');

    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(239,68,68,0.14),_rgba(255,255,255,1)_55%)] dark:bg-black px-4 py-10">
        <div className="mx-auto max-w-md rounded-[28px] border border-white/70 bg-white/80 p-6 text-center shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:bg-black dark:border-white/10">
          <Shield className="mx-auto mb-4 h-16 w-16 text-red-400" />
          <h1 className="mb-2 text-2xl font-bold text-slate-800 dark:text-slate-100">
            {hasSuperAdmin ? 'Ligipääs keelatud' : 'Esmane seadistus'}
          </h1>
          <p className="mb-6 text-slate-600 dark:text-slate-300">
            {hasSuperAdmin
              ? 'Sellele lehele pääseb ainult superadmin.'
              : 'Superadmini pole veel. Vajuta all, et saada esimeseks superadminiks.'}
          </p>
          {!hasSuperAdmin ? (
            <div className="space-y-3">
              <Button
                onClick={() => makeCurrentUserSuperAdmin.mutate()}
                disabled={makeCurrentUserSuperAdmin.isPending}
                className="w-full rounded-2xl bg-red-600 hover:bg-red-700"
              >
                Tee mind superadminiks
              </Button>
              <div className="flex items-center justify-center gap-2">
                <BackButton onClick={() => navigate(-1)} />
                <HomeButton />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <BackButton onClick={() => navigate(-1)} />
              <HomeButton />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.14),_rgba(255,255,255,1)_55%)] dark:bg-black px-4 pb-12">
      <div className="mx-auto max-w-6xl pt-6">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BackButton />
            <HomeButton />
          </div>
          <div className="flex items-center gap-2">
            <UserCog className="h-6 w-6 text-slate-700 dark:text-slate-100" />
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Admin paneel</h1>
          </div>
          <div className="w-16" />
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-6">
          <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:bg-black dark:border-white/10">
            <div className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-300">Kasutajaid kokku</div>
            <div className="mt-1 text-2xl font-bold text-slate-800 dark:text-slate-100">{totalUsers}</div>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm dark:bg-black dark:border-emerald-400/30">
            <div className="text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-300">Aktiivsed ({ACTIVITY_WINDOW_DAYS}p)</div>
            <div className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-200">{activeUsersCount}</div>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm dark:bg-black dark:border-blue-400/30">
            <div className="text-xs font-semibold uppercase text-blue-700 dark:text-blue-300">Aktiivsed mängud</div>
            <div className="mt-1 text-2xl font-bold text-blue-700 dark:text-blue-200">{activeHostedGames.length}</div>
          </div>
          <div className="rounded-2xl border border-purple-200 bg-purple-50 p-4 shadow-sm dark:bg-black dark:border-purple-400/30">
            <div className="text-xs font-semibold uppercase text-purple-700 dark:text-purple-300">Aktiivsed duellid</div>
            <div className="mt-1 text-2xl font-bold text-purple-700 dark:text-purple-200">{activeDuelGames.length}</div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 h-auto w-full grid grid-cols-3 rounded-2xl border border-white/70 bg-white/80 p-1 dark:bg-black dark:border-white/10">
            <TabsTrigger value="overview" className="rounded-xl text-xs sm:text-sm">Ülevaade</TabsTrigger>
            <TabsTrigger value="users" className="rounded-xl text-xs sm:text-sm">Kasutajad</TabsTrigger>
            <TabsTrigger value="system" className="rounded-xl text-xs sm:text-sm">Süsteem</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="rounded-[24px] border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur-sm dark:bg-black dark:border-white/10">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-100">
                <Users className="h-4 w-4 text-emerald-600" />
                Rollide jaotus
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className={`rounded-full px-3 py-1 font-semibold ${roleColors.user}`}>Kasutaja: {roleStats.user}</span>
                <span className={`rounded-full px-3 py-1 font-semibold ${roleColors.trainer}`}>Treener: {roleStats.trainer}</span>
                <span className={`rounded-full px-3 py-1 font-semibold ${roleColors.admin}`}>Admin: {roleStats.admin}</span>
                <span className={`rounded-full px-3 py-1 font-semibold ${roleColors.super_admin}`}>Superadmin: {roleStats.super_admin}</span>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur-sm dark:bg-black dark:border-white/10">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-100">
                <Gamepad2 className="h-4 w-4 text-emerald-600" />
                Join vaate aktiivsed mängud (viimased)
              </div>
              {recentJoinableEntries.length === 0 ? (
                <div className="text-sm text-slate-500 dark:text-slate-300">Aktiivseid mänge hetkel pole.</div>
              ) : (
                <div className="space-y-2">
                  {recentJoinableEntries.map((entry) => (
                    <div key={`${entry.kind}-${entry.id}`} className="rounded-xl border border-slate-100 bg-white/90 px-3 py-2 text-sm dark:bg-black dark:border-white/10">
                      <div className="font-semibold text-slate-800 dark:text-slate-100">{entry.name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-300">
                        {entry.kind === 'duel' ? 'Duell' : 'Mäng'} • PIN {entry.pin} • {formatActivityTime(entry.date)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-[24px] border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur-sm dark:bg-black dark:border-white/10">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-100">
                <Wrench className="h-4 w-4 text-emerald-600" />
                Kiirliikumine
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Button variant="outline" className="justify-start rounded-xl" onClick={() => navigate(createPageUrl('ManageGames'))}>
                  Mängude haldus
                </Button>
                <Button variant="outline" className="justify-start rounded-xl" onClick={() => navigate(createPageUrl('TrainerGroups'))}>
                  Treeneri grupid
                </Button>
                <Button variant="outline" className="justify-start rounded-xl" onClick={() => navigate(createPageUrl('PuttingRecordsPage'))}>
                  Rekordid
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <div className="rounded-[24px] border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur-sm dark:bg-black dark:border-white/10">
              <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                <Input
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Otsi nime või e-posti järgi"
                  className="h-11 rounded-xl"
                />
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue placeholder="Roll" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Kõik rollid</SelectItem>
                    <SelectItem value="user">Kasutaja</SelectItem>
                    <SelectItem value="trainer">Treener</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="super_admin">Superadmin</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={activityFilter} onValueChange={setActivityFilter}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue placeholder="Aktiivsus" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Kõik</SelectItem>
                    <SelectItem value="active">Aktiivsed ({ACTIVITY_WINDOW_DAYS}p)</SelectItem>
                    <SelectItem value="inactive">Mitteaktiivsed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-slate-200 dark:border-white/10">
                      <th className="px-2 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Nimi</th>
                      <th className="px-2 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">E-post</th>
                      <th className="px-2 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Roll</th>
                      <th className="px-2 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Aktiivsus</th>
                      <th className="px-2 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Viimane tegevus</th>
                      <th className="px-2 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Muuda rolli</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((entry) => (
                      <tr key={entry.id} className="border-b border-slate-100 hover:bg-slate-50/70 dark:border-white/10 dark:hover:bg-black">
                        <td className="px-2 py-3 font-medium text-slate-700 dark:text-slate-100">{entry.full_name || entry.display_name || entry.email}</td>
                        <td className="px-2 py-3 text-slate-600 dark:text-slate-300">{entry.email || '-'}</td>
                        <td className="px-2 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${roleColors[entry.app_role] || roleColors.user}`}>
                            {roleLabels[entry.app_role] || roleLabels.user}
                          </span>
                        </td>
                        <td className="px-2 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${entry.isActive
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-black dark:text-emerald-300 dark:border dark:border-emerald-400/40'
                            : 'bg-slate-100 text-slate-600 dark:bg-black dark:text-slate-300 dark:border dark:border-white/10'
                          }`}>
                            {entry.isActive ? 'Aktiivne' : 'Mitteaktiivne'}
                          </span>
                        </td>
                        <td className="px-2 py-3 text-xs text-slate-500 dark:text-slate-300">{formatActivityTime(entry.lastActivityTs)}</td>
                        <td className="px-2 py-3">
                          <Select
                            value={entry.app_role || 'user'}
                            onValueChange={(newRole) => updateRoleMutation.mutate({ userId: entry.id, newRole })}
                            disabled={entry.id === currentUser?.id || updateRoleMutation.isPending}
                          >
                            <SelectTrigger className="h-10 w-40 rounded-xl">
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
          </TabsContent>

          <TabsContent value="system" className="space-y-4">
            <div className="rounded-[24px] border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur-sm dark:bg-black dark:border-white/10">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-100">
                <Activity className="h-4 w-4 text-emerald-600" />
                Aktiivsuse loogika
              </div>
              <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <div>Aktiivne kasutaja = kasutajal on tegevus viimase {ACTIVITY_WINDOW_DAYS} päeva jooksul.</div>
                <div>Allikad: profiili kuupäevad, hostitud mängud, mängudes osalemine, duellides osalemine.</div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-white/90 px-3 py-2 dark:bg-black dark:border-white/10">
                  <div className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-300">Andmeaken</div>
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{ACTIVITY_WINDOW_DAYS} päeva</div>
                </div>
                <div className="rounded-xl border border-slate-100 bg-white/90 px-3 py-2 dark:bg-black dark:border-white/10">
                  <div className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-300">Viimane uuendus</div>
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{formatActivityTime(Date.now())}</div>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur-sm dark:bg-black dark:border-white/10">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-100">
                <CalendarClock className="h-4 w-4 text-emerald-600" />
                Milliseid kohti jälgida
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button variant="outline" className="justify-start rounded-xl" onClick={() => navigate(createPageUrl('ManageGames'))}>
                  Kontrolli aktiivseid mänge
                </Button>
                <Button variant="outline" className="justify-start rounded-xl" onClick={() => navigate(createPageUrl('TrainerGroups'))}>
                  Kontrolli trennigruppe
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
