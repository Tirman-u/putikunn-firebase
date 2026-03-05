import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  BookOpen,
  ChevronDown,
  Gamepad2,
  GraduationCap,
  LogOut,
  Sparkles,
  Trophy,
  User,
  BarChart3
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import BrandWordmark from '@/components/BrandWordmark';
import ThemeToggle from '@/components/ui/theme-toggle';
import LanguageToggle from '@/components/ui/language-toggle';
import VersionBadge from '@/components/VersionBadge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

const ROLE_LABELS = {
  super_admin: 'Superadmin',
  admin: 'Admin',
  trainer: 'Treener',
  user: 'Mängija'
};

export default function DashboardShell({
  activeNav = 'dashboard',
  title,
  subtitle,
  children
}) {
  const navigate = useNavigate();
  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const userRole = user?.app_role || 'user';
  const canManageGames = ['trainer', 'admin', 'super_admin'].includes(userRole);
  const canManageTraining = ['trainer', 'admin', 'super_admin'].includes(userRole);
  const displayName = user?.display_name || user?.full_name || user?.email || 'Külaline';
  const firstName = displayName.split(' ')[0] || 'OS';
  const roleLabel = ROLE_LABELS[userRole] || ROLE_LABELS.user;

  const dashboardLinks = [
    { key: 'dashboard', label: 'Dashboard', to: createPageUrl('Home'), icon: Sparkles },
    { key: 'games', label: 'Games', to: canManageGames ? createPageUrl('ManageGames') : `${createPageUrl('Home')}?mode=join`, icon: Gamepad2 },
    { key: 'training', label: 'Training', to: createPageUrl('JoinTraining'), icon: GraduationCap },
    { key: 'records', label: 'Records', to: createPageUrl('PuttingRecordsPage'), icon: Trophy },
    { key: 'courses', label: 'Courses', to: canManageTraining ? createPageUrl('TrainerGroups') : createPageUrl('Profile'), icon: BookOpen }
  ];

  const handleLogout = React.useCallback(async () => {
    await base44.auth.logout(true);
  }, []);

  return (
    <div className="min-h-screen bg-[#17191b] px-2 py-3 sm:px-4 sm:py-7 dark:bg-black">
      <div className="mx-auto w-full max-w-[1220px] overflow-hidden rounded-[18px] border border-[#d9dee2] bg-[#f3f4f5] shadow-[0_30px_80px_rgba(0,0,0,0.35)] dark:border-[#14363f] dark:bg-black">
        <header className="border-b border-[#e5e9ec] bg-white px-4 py-3 sm:px-6 dark:border-[#14363f] dark:bg-black">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link
                to={createPageUrl('Home')}
                className="inline-flex items-center gap-3 rounded-xl px-1 py-0.5 transition hover:bg-[#edf2f4] dark:hover:bg-[#07161b]"
                aria-label="Ava avaleht"
              >
                <BrandWordmark />
              </Link>
              <nav className="ml-4 hidden items-center gap-1 lg:flex">
                {dashboardLinks.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeNav === item.key;
                  return (
                    <Link
                      key={item.key}
                      to={item.to}
                      className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                        isActive
                          ? 'bg-[#d8f3ef] text-[#1f9c8d]'
                          : 'text-slate-600 hover:bg-[#edf2f4] hover:text-slate-800 dark:text-slate-300 dark:hover:bg-[#07161b] dark:hover:text-slate-100'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#e3e8eb] text-slate-500 transition hover:bg-[#eef4f5] hover:text-slate-700 dark:border-[#14363f] dark:text-slate-300 dark:hover:bg-[#07161b] dark:hover:text-slate-100"
              >
                <Bell className="h-4 w-4" />
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-xl border border-[#e3e8eb] bg-white px-2.5 py-1.5 text-left transition hover:bg-[#f6f9fa] dark:border-[#14363f] dark:bg-black dark:hover:bg-[#07161b]"
                  >
                    <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-md bg-gradient-to-br from-[#28b39a] to-[#1f9c8d] text-xs font-semibold text-white">
                      {firstName?.slice(0, 2)?.toUpperCase()}
                    </div>
                    <div className="hidden sm:block">
                      <div className="text-xs font-semibold leading-4 text-slate-800 dark:text-slate-100">{displayName}</div>
                      <div className="text-[11px] leading-4 text-slate-500 dark:text-slate-400">{roleLabel}</div>
                    </div>
                    <ChevronDown className="h-3.5 w-3.5 text-slate-500 dark:text-slate-300" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[250px] p-1.5">
                  <DropdownMenuLabel className="normal-case">
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{displayName}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{roleLabel}</div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => navigate(createPageUrl('Profile'))}>
                    <User className="h-4 w-4 text-slate-500" />
                    <span>Minu profiil</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigate(createPageUrl('PuttingRecordsPage'))}>
                    <BarChart3 className="h-4 w-4 text-slate-500" />
                    <span>Rekordid</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <div className="flex items-center justify-between px-2 py-2">
                    <LanguageToggle />
                    <ThemeToggle />
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={handleLogout} className="text-red-600 dark:text-red-400">
                    <LogOut className="h-4 w-4" />
                    <span>Logi välja</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-1 overflow-auto pb-1 lg:hidden">
            {dashboardLinks.map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.key;
              return (
                <Link
                  key={item.key}
                  to={item.to}
                  className={`inline-flex items-center gap-1 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-medium ${
                    isActive
                      ? 'bg-[#d8f3ef] text-[#1f9c8d]'
                      : 'text-slate-600 hover:bg-[#edf2f4] dark:text-slate-300 dark:hover:bg-[#07161b]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </header>

        <main className="px-4 pb-6 pt-6 sm:px-8 sm:pb-8 sm:pt-8">
          {(title || subtitle) && (
            <section>
              {title && (
                <h1 className="text-3xl font-bold tracking-tight text-[#1b2639] sm:text-[50px] sm:leading-[56px] dark:text-slate-100">
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="mt-2 text-sm text-slate-500 sm:text-xl dark:text-slate-300">
                  {subtitle}
                </p>
              )}
            </section>
          )}

          <div className={title || subtitle ? 'mt-6' : ''}>
            {children}
          </div>
        </main>
      </div>
      <VersionBadge />
    </div>
  );
}
