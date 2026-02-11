import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Copy, Trash2, Users, MonitorPlay, Gamepad2, Pencil, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { db } from '@/lib/firebase';
import { createPageUrl } from '@/utils';
import { GAME_FORMATS } from '@/components/putting/gameRules';
import BackButton from '@/components/ui/back-button';
import HomeButton from '@/components/ui/home-button';
import { useLanguage } from '@/lib/i18n';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  deleteField,
  arrayRemove,
  deleteDoc
} from 'firebase/firestore';

const generatePin = () => Math.floor(1000 + Math.random() * 9000).toString();

export default function TrainerGroups() {
  const navigate = useNavigate();
  const { lang, t } = useLanguage();
  const tr = React.useCallback((et, en) => (lang === 'en' ? en : et), [lang]);
  const [newGroupName, setNewGroupName] = React.useState('');
  const [isCreating, setIsCreating] = React.useState(false);
  const [gamePinsByGroup, setGamePinsByGroup] = React.useState({});
  const [isAddingGameByGroup, setIsAddingGameByGroup] = React.useState({});
  const [editingGroupId, setEditingGroupId] = React.useState(null);
  const [editingGroupName, setEditingGroupName] = React.useState('');
  const [isSavingGroup, setIsSavingGroup] = React.useState({});
  const [isDeletingGroup, setIsDeletingGroup] = React.useState({});

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const userRole = user?.app_role || 'user';
  const canManageTraining = ['trainer', 'admin', 'super_admin'].includes(userRole);
  const isAdmin = ['admin', 'super_admin'].includes(userRole);

  React.useEffect(() => {
    if (user && !canManageTraining) {
      navigate(createPageUrl('Home'));
    }
  }, [user, canManageTraining, navigate]);

  if (user && !canManageTraining) {
    return null;
  }

  const { data: groups = [], isLoading, refetch } = useQuery({
    queryKey: ['trainer-groups', user?.id, userRole],
    enabled: !!user?.id,
    queryFn: async () => {
      const groupsRef = collection(db, 'training_groups');
      const q = isAdmin
        ? query(groupsRef, orderBy('created_at', 'desc'))
        : query(
            groupsRef,
            where('created_by_uid', '==', user.id),
            orderBy('created_at', 'desc')
          );
      const snap = await getDocs(q);
      return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    },
    staleTime: 30000
  });

  const groupIds = React.useMemo(() => groups.map((group) => group.id).filter(Boolean), [groups]);

  const { data: trainingGames = [], refetch: refetchTrainingGames } = useQuery({
    queryKey: ['training-games', groupIds.join('|')],
    enabled: groupIds.length > 0,
    queryFn: async () => {
      const allGames = [];
      const chunkSize = 10;
      for (let i = 0; i < groupIds.length; i += chunkSize) {
        const chunk = groupIds.slice(i, i + chunkSize);
        const games = await base44.entities.Game.filter({
          training_group_id: { $in: chunk },
          status: { $in: ['setup', 'active'] }
        }, '-date', 50);
        allGames.push(...games);
      }
      return allGames.filter((game) =>
        game?.pin &&
        game.pin !== '0000' &&
        game.join_closed !== true &&
        game.status !== 'closed'
      );
    },
    staleTime: 15000
  });

  const gamesByGroup = React.useMemo(() => {
    const map = {};
    trainingGames.forEach((game) => {
      const groupId = game?.training_group_id;
      if (!groupId) return;
      if (!map[groupId]) map[groupId] = [];
      map[groupId].push(game);
    });
    Object.values(map).forEach((games) => {
      games.sort((a, b) => (b?.date || '').localeCompare(a?.date || ''));
    });
    return map;
  }, [trainingGames]);

  const ensureUniquePin = async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const pin = generatePin();
      const snap = await getDocs(
        query(collection(db, 'training_groups'), where('pin', '==', pin), limit(1))
      );
      if (snap.empty) return pin;
    }
    throw new Error(tr('PINi loomine ebaõnnestus. Proovi uuesti.', 'PIN creation failed. Please try again.'));
  };

  const handleCreateGroup = async () => {
    if (!user?.id) return;
    setIsCreating(true);
    try {
      const pin = await ensureUniquePin();
      const displayName = user?.display_name || user?.full_name || tr('Treener', 'Coach');
      const name = newGroupName.trim() || tr(`${displayName} trenn`, `${displayName} training`);

      await addDoc(collection(db, 'training_groups'), {
        name,
        pin,
        trainer_name: displayName,
        created_by: user.email,
        created_by_uid: user.id,
        created_at: serverTimestamp(),
        members: {},
        member_uids: [],
        slots: [],
        attendance: {},
        has_public_slots: false
      });

      setNewGroupName('');
      toast.success(tr('Grupp loodud', 'Group created'));
      refetch();
    } catch (error) {
      toast.error(error?.message || tr('Grupi loomine ebaõnnestus', 'Failed to create group'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleAttachGame = async (group) => {
    const rawPin = gamePinsByGroup[group.id] || '';
    const cleanedPin = rawPin.replace(/\D/g, '').slice(0, 4);
    if (cleanedPin.length !== 4) {
      toast.error(tr('Sisesta 4-kohaline mängu PIN', 'Enter a 4-digit game PIN'));
      return;
    }

    setIsAddingGameByGroup((prev) => ({ ...prev, [group.id]: true }));
    try {
      const games = await base44.entities.Game.filter({ pin: cleanedPin }, '-date', 1);
      if (!games?.length) {
        toast.error(tr('Mängu ei leitud', 'Game not found'));
        return;
      }
      const game = games[0];
      await base44.entities.Game.update(game.id, { training_group_id: group.id });
      toast.success(tr(`Mäng lisatud gruppi "${group.name || 'Treening'}"`, `Game added to group "${group.name || 'Training'}"`));
      setGamePinsByGroup((prev) => ({ ...prev, [group.id]: '' }));
      refetchTrainingGames();
    } catch (error) {
      toast.error(error?.message || tr('Mängu lisamine ebaõnnestus', 'Failed to add game'));
    } finally {
      setIsAddingGameByGroup((prev) => ({ ...prev, [group.id]: false }));
    }
  };

  const startEditingGroup = (group) => {
    setEditingGroupId(group.id);
    setEditingGroupName(group?.name || '');
  };

  const cancelEditingGroup = () => {
    setEditingGroupId(null);
    setEditingGroupName('');
  };

  const handleRenameGroup = async (group) => {
    const nextName = editingGroupName.trim();
    if (!nextName) {
      toast.error(tr('Sisesta grupi nimi', 'Enter a group name'));
      return;
    }
    setIsSavingGroup((prev) => ({ ...prev, [group.id]: true }));
    try {
      await updateDoc(doc(db, 'training_groups', group.id), {
        name: nextName
      });

      const memberIds = group?.member_uids?.length
        ? group.member_uids
        : Object.keys(group?.members || {});
      if (memberIds.length > 0) {
        await Promise.all(
          memberIds.map((uid) =>
            updateDoc(doc(db, 'users', uid), {
              [`training_groups.${group.id}`]: nextName
            })
          )
        );
      }

      toast.success(tr('Grupi nimi uuendatud', 'Group name updated'));
      cancelEditingGroup();
      refetch();
    } catch (error) {
      toast.error(error?.message || tr('Nime uuendamine ebaõnnestus', 'Failed to update name'));
    } finally {
      setIsSavingGroup((prev) => ({ ...prev, [group.id]: false }));
    }
  };

  const handleDeleteGroup = async (group) => {
    if (!confirm(tr(`Kustuta grupp "${group.name || 'Treening'}"? Seda ei saa tagasi võtta.`, `Delete group "${group.name || 'Training'}"? This cannot be undone.`))) {
      return;
    }
    setIsDeletingGroup((prev) => ({ ...prev, [group.id]: true }));
    try {
      const memberIds = group?.member_uids?.length
        ? group.member_uids
        : Object.keys(group?.members || {});

      if (memberIds.length > 0) {
        await Promise.all(
          memberIds.map((uid) =>
            updateDoc(doc(db, 'users', uid), {
              [`training_groups.${group.id}`]: deleteField()
            })
          )
        );
      }

      const pageSize = 50;
      let skip = 0;
      while (true) {
        const games = await base44.entities.Game.filter(
          { training_group_id: group.id },
          '-date',
          pageSize,
          skip
        );
        if (!games?.length) break;
        await Promise.all(
          games.map((game) => base44.entities.Game.update(game.id, { training_group_id: null }))
        );
        if (games.length < pageSize) break;
        skip += games.length;
      }

      await deleteDoc(doc(db, 'training_groups', group.id));
      toast.success(tr('Grupp kustutatud', 'Group deleted'));
      refetch();
      refetchTrainingGames();
    } catch (error) {
      toast.error(error?.message || tr('Grupi kustutamine ebaõnnestus', 'Failed to delete group'));
    } finally {
      setIsDeletingGroup((prev) => ({ ...prev, [group.id]: false }));
    }
  };

  const handleCopyPin = async (pin) => {
    try {
      await navigator.clipboard.writeText(pin);
      toast.success(tr('PIN kopeeritud', 'PIN copied'));
    } catch {
      toast.error(tr('PIN kopeerimine ebaõnnestus', 'Failed to copy PIN'));
    }
  };

  const handleRemoveMember = async (groupId, memberUid) => {
    try {
      await updateDoc(doc(db, 'training_groups', groupId), {
        member_uids: arrayRemove(memberUid),
        [`members.${memberUid}`]: deleteField()
      });
      await updateDoc(doc(db, 'users', memberUid), {
        [`training_groups.${groupId}`]: deleteField()
      });
      toast.success(tr('Liige eemaldatud', 'Member removed'));
      refetch();
    } catch (error) {
      toast.error(error?.message || tr('Eemaldamine ebaõnnestus', 'Removal failed'));
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_rgba(255,255,255,1)_55%)] px-4 dark:bg-black dark:text-slate-100">
      <div className="max-w-4xl mx-auto pt-6 pb-16">
        <div className="mb-6 flex items-center gap-2">
          <BackButton fallbackTo={createPageUrl('Home')} forceFallback label={tr('Tagasi', 'Back')} />
          <HomeButton label={tr('Avaleht', 'Home')} />
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">{tr('Treener', 'Coach')}</h1>
          <p className="text-slate-500">{tr('Halda gruppe, mänge ja projektori vaadet.', 'Manage groups, games, and the projector view.')}</p>
        </div>

        <div className="rounded-[28px] border border-white/70 bg-white/70 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm mb-6 dark:bg-black dark:border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-slate-800">{tr('Treeneri projektor', 'Coach projector')}</div>
              <div className="text-xs text-slate-500">{tr('3 PIN-iga live edetabelid ühel ekraanil.', 'Up to 3 live leaderboards by PIN on one screen.')}</div>
            </div>
            <button
              type="button"
              onClick={() => window.open(createPageUrl('TrainerProjector'), '_blank', 'noopener')}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700"
            >
              <MonitorPlay className="w-4 h-4" />
              {tr('Ava projektor', 'Open projector')}
            </button>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/70 bg-white/70 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm mb-8 dark:bg-black dark:border-white/10">
          <div className="text-xs font-semibold text-slate-500 uppercase mb-3">{tr('Uus grupp', 'New group')}</div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder={tr('Grupi nimi (valikuline)', 'Group name (optional)')}
              className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:bg-black dark:border-white/10 dark:text-slate-100"
            />
            <button
              type="button"
              onClick={handleCreateGroup}
              disabled={isCreating}
              className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {isCreating ? tr('Loon...', 'Creating...') : tr('Loo grupp', 'Create group')}
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center text-slate-500">{tr('Laen gruppe...', 'Loading groups...')}</div>
        ) : groups.length === 0 ? (
          <div className="rounded-3xl border border-white/70 bg-white/70 p-10 text-center text-slate-500 shadow-sm backdrop-blur-sm dark:bg-black dark:border-white/10">
            {tr('Grupe pole veel loodud.', 'No groups created yet.')}
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => {
              const members = group?.members || {};
              const memberEntries = Object.entries(members);
              const groupGames = gamesByGroup[group.id] || [];
              return (
                <div key={group.id} className="rounded-[28px] border border-white/70 bg-white/70 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:bg-black dark:border-white/10">
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        {editingGroupId === group.id ? (
                          <>
                            <input
                              value={editingGroupName}
                              onChange={(event) => setEditingGroupName(event.target.value)}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:bg-black dark:border-white/10 dark:text-slate-100"
                            />
                            <button
                              type="button"
                              onClick={() => handleRenameGroup(group)}
                              disabled={isSavingGroup[group.id]}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                              title={tr('Salvesta', 'Save')}
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditingGroup}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/70 bg-white/70 text-slate-600 shadow-sm hover:bg-white dark:bg-black dark:border-white/10 dark:text-slate-200"
                              title={tr('Tühista', 'Cancel')}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <div className="text-lg font-bold text-slate-800">{group.name}</div>
                            <button
                              type="button"
                              onClick={() => startEditingGroup(group)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/70 bg-white/70 text-slate-600 shadow-sm hover:bg-white dark:bg-black dark:border-white/10 dark:text-slate-200"
                              title={tr('Muuda nime', 'Rename')}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                      <div className="text-sm text-slate-500 flex items-center gap-2 mt-1">
                        <Users className="w-4 h-4" />
                        {tr(`${memberEntries.length} liiget`, `${memberEntries.length} members`)}
                      </div>
                      {isAdmin && group.created_by && (
                        <div className="text-xs text-slate-400">{tr('Treener', 'Coach')}: {group.created_by}</div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`${createPageUrl('TrainerGroupDashboard')}?id=${group.id}`)}
                        className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 dark:bg-white dark:text-slate-900"
                      >
                        {tr('Ava trenn', 'Open training')}
                      </button>
                      <div className="rounded-2xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 dark:bg-black dark:text-emerald-300 dark:border dark:border-white/10">
                        {tr('PIN', 'PIN')}: {group.pin}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyPin(group.pin)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/70 bg-white/70 text-slate-600 shadow-sm hover:bg-white dark:bg-black dark:border-white/10 dark:text-slate-200"
                        title={tr('Kopeeri PIN', 'Copy PIN')}
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteGroup(group)}
                        disabled={isDeletingGroup[group.id]}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/70 bg-white/70 text-red-600 shadow-sm hover:bg-red-50 disabled:opacity-60 dark:bg-black dark:border-white/10"
                        title={tr('Kustuta grupp', 'Delete group')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 mb-4 dark:bg-black dark:border-white/10">
                    <div className="text-xs font-semibold text-slate-500 uppercase mb-2">{tr('Lisa mäng PIN-iga', 'Add game by PIN')}</div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        value={gamePinsByGroup[group.id] || ''}
                        onChange={(e) => setGamePinsByGroup((prev) => ({ ...prev, [group.id]: e.target.value }))}
                        placeholder="1234"
                        inputMode="numeric"
                        maxLength={4}
                        className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:bg-black dark:border-white/10 dark:text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={() => handleAttachGame(group)}
                        disabled={isAddingGameByGroup[group.id]}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                      >
                        <Gamepad2 className="w-4 h-4" />
                        {isAddingGameByGroup[group.id] ? tr('Lisan...', 'Adding...') : tr('Lisa mäng', 'Add game')}
                      </button>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="text-xs font-semibold text-slate-500 uppercase mb-2">{tr('Aktiivsed trennimängud', 'Active training games')}</div>
                    {groupGames.length === 0 ? (
                      <div className="text-sm text-slate-500">{tr('Aktiivseid mänge pole.', 'No active games.')}</div>
                    ) : (
                      <div className="space-y-2">
                        {groupGames.map((game) => {
                          const format = GAME_FORMATS[game.game_type] || {};
                          return (
                            <div
                              key={game.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-white px-4 py-3 dark:bg-black dark:border-white/10"
                            >
                                <div>
                                  <div className="text-sm font-semibold text-slate-800">{game.name}</div>
                                  <div className="text-xs text-slate-500">
                                    {t(`format.${game.game_type}.name`, format.name || game.game_type)}
                                  </div>
                                </div>
                              <div className="flex items-center gap-2">
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-black dark:text-slate-300 dark:border dark:border-white/10">
                                  PIN: {game.pin}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
