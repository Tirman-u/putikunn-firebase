import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { Home, Trophy, User, UserPlus, Users2, GraduationCap } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';

const TRAINER_ROUTES = new Set([
  '/TrainerGroups',
  '/ManageGames',
  '/AdminUsers'
]);

const TRAINING_ROUTES = new Set([
  '/JoinTraining',
  '/TrainingLeague',
  '/TrainingSeason',
  '/TrainingSession'
]);

const BASE_VISIBLE_ROUTES = new Set([
  '/',
  '/Home',
  '/PuttingRecordsPage',
  '/Profile',
  '/TrainerGroups',
  '/ManageGames',
  '/JoinTraining',
  '/TrainingLeague',
  '/TrainingSeason',
  '/TrainingSession',
  '/AdminUsers'
]);

const HIDDEN_HOME_MODES = new Set([
  'host-setup',
  'solo',
  'host',
  'player',
  'atw-setup',
  'atw-game',
  'atw-host',
  'time-ladder-setup'
]);

export default function MobileBottomNav() {
  const location = useLocation();
  const path = location?.pathname || '';
  const searchParams = new URLSearchParams(location?.search || '');
  const homeMode = searchParams.get('mode');

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const userRole = user?.app_role || 'user';
  const canManageTraining = ['trainer', 'admin', 'super_admin'].includes(userRole);

  if (!BASE_VISIBLE_ROUTES.has(path)) return null;
  if (path === '/Login') return null;
  if ((path === '/' || path === '/Home') && homeMode && HIDDEN_HOME_MODES.has(homeMode)) return null;

  const items = [
    {
      key: 'home',
      label: 'Avaleht',
      to: createPageUrl('Home'),
      icon: Home,
      active: (path === '/' || path === '/Home') && !homeMode
    },
    {
      key: 'join',
      label: 'Liitu',
      to: `${createPageUrl('Home')}?mode=join`,
      icon: UserPlus,
      active: (path === '/' || path === '/Home') && homeMode === 'join'
    },
    {
      key: 'join-training',
      label: 'Trenn',
      to: createPageUrl('JoinTraining'),
      icon: GraduationCap,
      active: TRAINING_ROUTES.has(path)
    },
    {
      key: 'records',
      label: 'Rekordid',
      to: createPageUrl('PuttingRecordsPage'),
      icon: Trophy,
      active: path === '/PuttingRecordsPage'
    },
    {
      key: 'profile',
      label: 'Profiil',
      to: createPageUrl('Profile'),
      icon: User,
      active: path === '/Profile'
    }
  ];

  if (canManageTraining) {
    items.push({
      key: 'trainer',
      label: 'Treener',
      to: createPageUrl('TrainerGroups'),
      icon: Users2,
      active: TRAINER_ROUTES.has(path)
    });
  }

  const gridColsClass = items.length >= 6 ? 'grid-cols-6' : items.length === 5 ? 'grid-cols-5' : 'grid-cols-4';

  return (
    <nav className="fixed inset-x-3 bottom-3 z-40 rounded-2xl border border-border bg-card/95 p-1.5 shadow-[0_14px_34px_rgba(26,43,46,0.22)] backdrop-blur md:hidden">
      <ul className={`grid gap-1 ${gridColsClass}`}>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.key}>
              <Link
                to={item.to}
                className={
                  'flex flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-[10px] font-semibold transition ' +
                  (item.active
                    ? 'border-[#97D6CD] bg-[#E7F7F2] text-[#007377] dark:border-[#2E6D67] dark:bg-[#183134] dark:text-[#5EEAD4]'
                    : 'border-transparent text-muted-foreground hover:border-border hover:bg-secondary hover:text-foreground')
                }
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
