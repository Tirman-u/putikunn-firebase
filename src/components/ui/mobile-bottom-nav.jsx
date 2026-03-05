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
  const navRef = React.useRef(null);

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const userRole = user?.app_role || 'user';
  const canManageTraining = ['trainer', 'admin', 'super_admin'].includes(userRole);

  const shouldShowNav =
    BASE_VISIBLE_ROUTES.has(path)
    && path !== '/Login'
    && !((path === '/' || path === '/Home') && homeMode && HIDDEN_HOME_MODES.has(homeMode));

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

  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;

    const root = document.documentElement;

    const applyOffset = () => {
      const isMobile = window.matchMedia('(max-width: 767px)').matches;
      if (!shouldShowNav || !isMobile || !navRef.current) {
        root.classList.remove('pk-mobile-nav-active');
        root.style.setProperty('--pk-mobile-nav-offset', '0px');
        return;
      }

      const navHeight = Math.ceil(navRef.current.getBoundingClientRect().height);
      // Include a small breathing gap so bottom content never sits under the nav.
      root.style.setProperty('--pk-mobile-nav-offset', `${navHeight + 16}px`);
      root.classList.add('pk-mobile-nav-active');
    };

    const rafId = window.requestAnimationFrame(applyOffset);
    window.addEventListener('resize', applyOffset);

    let observer;
    if (typeof window.ResizeObserver !== 'undefined' && navRef.current) {
      observer = new window.ResizeObserver(applyOffset);
      observer.observe(navRef.current);
    }

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', applyOffset);
      if (observer) observer.disconnect();
      root.classList.remove('pk-mobile-nav-active');
      root.style.setProperty('--pk-mobile-nav-offset', '0px');
    };
  }, [shouldShowNav, items.length]);

  if (!shouldShowNav) return null;

  return (
    <nav
      ref={navRef}
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-40 rounded-[24px] border border-white/80 bg-white/90 p-1.5 shadow-[0_14px_30px_rgba(15,23,42,0.12)] backdrop-blur-sm md:hidden dark:bg-black dark:border-white/15"
    >
      <ul className={`grid gap-1 ${gridColsClass}`}>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.key}>
              <Link
                to={item.to}
                className={
                  'flex flex-col items-center justify-center gap-1 rounded-[16px] px-2 py-2 text-[10px] font-semibold transition ' +
                  (item.active
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-black dark:border dark:border-emerald-400/40 dark:text-emerald-300'
                    : 'text-slate-500 hover:bg-slate-100/80 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-black')
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
