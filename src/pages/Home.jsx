import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  UserPlus,
  Settings,
  User,
  Target,
  Trophy,
  Crown,
  Shield,
  LogOut,
  GraduationCap,
  Users2,
  Bell,
  ChevronDown,
  Sparkles,
  BookOpen,
  BarChart3,
  Gamepad2
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { FEATURE_FLAGS } from '@/lib/feature-flags';

import HostSetup from '@/components/putting/HostSetup';
import JoinGame from '@/components/putting/JoinGame';
import HostView from '@/components/putting/HostView';
import PlayerView from '@/components/putting/PlayerView';
import AroundTheWorldSetup from '@/components/putting/AroundTheWorldSetup';
import AroundTheWorldGameView from '@/components/putting/AroundTheWorldGameView';
import TimeLadderSetup from '@/components/putting/TimeLadderSetup';
import { GAME_FORMATS } from '@/components/putting/gameRules';
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
import { useLanguage } from '@/lib/i18n';

export default function Home() {
  const { t } = useLanguage();
  const [mode, setMode] = useState(null); // null, 'host-setup', 'join', 'solo', 'host', 'player', 'atw-setup', 'atw-game', 'atw-host', 'time-ladder-setup'
  const [gameId, setGameId] = useState(null);
  const [playerName, setPlayerName] = useState(null);
  const [isSoloATW, setIsSoloATW] = useState(false);
  const [atwPin, setAtwPin] = useState(null);
  const [atwName, setAtwName] = useState(null);
  const [atwPuttType, setAtwPuttType] = useState(null);
  const [timeLadderName, setTimeLadderName] = useState(null);
  const [timeLadderPuttType, setTimeLadderPuttType] = useState(null);
  const [playerReturnTo, setPlayerReturnTo] = useState('home');
  const navigate = useNavigate();
  const location = useLocation();

  const goHome = React.useCallback(() => {
    setMode(null);
    navigate(createPageUrl('Home'), { replace: true });
  }, [navigate]);

  const handleLogout = React.useCallback(async () => {
    await base44.auth.logout(true);
  }, []);

  const setSimpleMode = React.useCallback((nextMode) => {
    setMode(nextMode);
    navigate(`${createPageUrl('Home')}?mode=${nextMode}`, { replace: true });
  }, [navigate]);

  // Check URL params for ATW mode and continuing games
  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlMode = params.get('mode');
    const isSolo = params.get('solo') === '1';
    const urlGameId = params.get('gameId');
    const urlFrom = params.get('from');

    if (urlMode === 'host-setup') {
      setMode('host-setup');
    } else if (urlMode === 'join') {
      setMode('join');
    } else if (urlMode === 'solo') {
      setMode('solo');
    } else if (urlMode === 'time-ladder-setup') {
      setMode('time-ladder-setup');
      const urlName = params.get('name');
      const urlPuttType = params.get('puttType');
      if (urlName) {
        setTimeLadderName(decodeURIComponent(urlName));
      }
      if (urlPuttType) {
        setTimeLadderPuttType(urlPuttType);
      }
    } else if (urlMode === 'atw-setup') {
      setIsSoloATW(isSolo);
      setMode('atw-setup');
      // Store pin, name, and puttType if available
      const urlPin = params.get('pin');
      const urlName = params.get('name');
      const urlPuttType = params.get('puttType');
      if (urlPin) {
        setAtwPin(urlPin);
      }
      if (urlName) {
        setAtwName(decodeURIComponent(urlName));
      }
      if (urlPuttType) {
        setAtwPuttType(urlPuttType);
      }
      // Keep URL for shareable setup state
    } else if (urlMode === 'atw-host' && urlGameId) {
      setGameId(urlGameId);
      setMode('atw-host');
    } else if (urlMode === 'host' && urlGameId) {
      setGameId(urlGameId);
      setMode('host');
    } else if (urlMode === 'atw-game' && urlGameId) {
      // Continue ATW game from profile
      setGameId(urlGameId);
      base44.entities.Game.filter({ id: urlGameId }).then(games => {
        const game = games?.[0];
        if (!game) return;
        setIsSoloATW(game.pin === '0000');
        base44.auth.me().then(user => {
          const playerName = user?.display_name || user?.full_name || user?.email || t('home.guest', 'Mängija');
          setPlayerName(playerName);
          setMode('atw-game');
        });
      });
    } else if (urlMode === 'player' && urlGameId) {
      // Continue regular game from profile
      setGameId(urlGameId);
      setPlayerReturnTo(urlFrom === 'training' ? 'training' : 'home');
      base44.auth.me().then(user => {
        const playerName = user?.display_name || user?.full_name || user?.email || t('home.guest', 'Mängija');
        setPlayerName(playerName);
        setMode('player');
      });
    } else if (!urlMode) {
      setMode(null);
    }
  }, [location.search, t]);

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const userRole = user?.app_role || 'user';
  const canHostGames = ['trainer', 'admin', 'super_admin'].includes(userRole);
  const canManageGames = ['trainer', 'admin', 'super_admin'].includes(userRole);
  const canManageTraining = ['trainer', 'admin', 'super_admin'].includes(userRole);
  const showTrainingFeatures = true;

  const trainingGroups = React.useMemo(() => {
    const groups = user?.training_groups;
    if (!groups || typeof groups !== 'object') return [];
    return Object.values(groups).filter(Boolean);
  }, [user]);
  const trainingLabel = trainingGroups.length
    ? (trainingGroups.length === 1 ? trainingGroups[0] : `${trainingGroups[0]} +${trainingGroups.length - 1}`)
    : t('home.join_training', 'Liitu trenniga');
  const trainingSub = trainingGroups.length ? t('home.training', 'Trenn') : t('home.join_sub', 'Sisesta PIN');

  const { data: homeGames = [] } = useQuery({
    queryKey: ['home-dashboard-games', user?.email, user?.full_name, user?.display_name],
    queryFn: async () => {
      if (!user) return [];
      const results = [];
      if (user.email) {
        results.push(...await base44.entities.Game.filter({ host_user: user.email }));
      }
      if (user.full_name) {
        results.push(...await base44.entities.Game.filter({ players: { $arrayContains: user.full_name } }));
      }
      if (user.display_name && user.display_name !== user.full_name) {
        results.push(...await base44.entities.Game.filter({ players: { $arrayContains: user.display_name } }));
      }
      const byId = new Map();
      results.forEach((game) => {
        if (game?.id && !byId.has(game.id)) byId.set(game.id, game);
      });
      return Array.from(byId.values());
    },
    enabled: !!user
  });

  const tileThemes = {
    emerald: { bg: 'bg-emerald-100 dark:bg-black', icon: 'text-emerald-600', ring: 'ring-emerald-200 dark:ring-[#1f4b56]', glow: 'shadow-emerald-100/60 dark:shadow-emerald-500/10' },
    sky: { bg: 'bg-sky-100 dark:bg-black', icon: 'text-sky-600', ring: 'ring-sky-200 dark:ring-[#1f4b56]', glow: 'shadow-sky-100/60 dark:shadow-sky-500/10' },
    amber: { bg: 'bg-amber-100 dark:bg-black', icon: 'text-amber-600', ring: 'ring-amber-200 dark:ring-[#1f4b56]', glow: 'shadow-amber-100/60 dark:shadow-amber-500/10' },
    purple: { bg: 'bg-purple-100 dark:bg-black', icon: 'text-purple-600', ring: 'ring-purple-200 dark:ring-[#1f4b56]', glow: 'shadow-purple-100/60 dark:shadow-purple-500/10' },
    blue: { bg: 'bg-blue-100 dark:bg-black', icon: 'text-blue-600', ring: 'ring-blue-200 dark:ring-[#1f4b56]', glow: 'shadow-blue-100/60 dark:shadow-blue-500/10' },
    slate: { bg: 'bg-slate-100 dark:bg-black', icon: 'text-slate-600', ring: 'ring-slate-200 dark:ring-[#1f4b56]', glow: 'shadow-slate-100/60 dark:shadow-white/5' },
    red: { bg: 'bg-red-100 dark:bg-black', icon: 'text-red-600', ring: 'ring-red-200 dark:ring-[#1f4b56]', glow: 'shadow-red-100/60 dark:shadow-red-500/10' }
  };

  const homeTiles = [
    {
      key: 'host',
      label: t('home.host', 'Hosti mäng'),
      sub: t('home.host_sub', 'Loo sessioon'),
      icon: Users,
      color: 'emerald',
      onClick: () => setSimpleMode('host-setup'),
      show: canHostGames
    },
    {
      key: 'join',
      label: t('home.join', 'Liitu mänguga'),
      sub: t('home.join_sub', 'Sisesta PIN'),
      icon: UserPlus,
      color: 'sky',
      onClick: () => setSimpleMode('join'),
      show: true
    },
    {
      key: 'training-join',
      label: trainingLabel,
      sub: trainingSub,
      icon: GraduationCap,
      color: 'purple',
      to: createPageUrl('JoinTraining'),
      show: showTrainingFeatures
    },
    {
      key: 'solo',
      label: t('home.solo', 'Soolotreening'),
      sub: t('home.solo_sub', 'Harjuta üksi'),
      icon: Target,
      color: 'emerald',
      onClick: () => setSimpleMode('solo'),
      show: true
    },
    {
      key: 'records',
      label: t('home.records', 'Rekordid'),
      sub: t('home.records_sub', 'Edetabelid'),
      icon: Trophy,
      color: 'amber',
      href: createPageUrl('PuttingRecordsPage'),
      show: true,
      hideOnMobile: true
    },
    {
      key: 'king',
      label: t('home.king', 'Kuningas'),
      sub: t('home.king_sub', 'Turniirid'),
      icon: Crown,
      color: 'purple',
      href: createPageUrl('PuttingKing'),
      show: FEATURE_FLAGS.puttingKing
    },
    {
      key: 'profile',
      label: t('home.profile', 'Minu profiil'),
      sub: t('home.profile_sub', 'Statistika'),
      icon: User,
      color: 'slate',
      to: createPageUrl('Profile'),
      show: true,
      hideOnMobile: true
    },
    {
      key: 'manage',
      label: t('home.manage', 'Halda mänge'),
      sub: t('home.manage_sub', 'Admin'),
      icon: Settings,
      color: 'blue',
      to: createPageUrl('ManageGames'),
      show: canManageGames
    },
    {
      key: 'trainer',
      label: t('home.trainer', 'Treener'),
      sub: t('home.trainer_sub', 'Grupid & projektor'),
      icon: Users2,
      color: 'amber',
      to: createPageUrl('TrainerGroups'),
      show: canManageTraining && showTrainingFeatures
    },
    {
      key: 'admin',
      label: t('home.admin', 'Kasutajad'),
      sub: t('home.admin_sub', 'Superadmin'),
      icon: Shield,
      color: 'red',
      to: createPageUrl('AdminUsers'),
      show: userRole === 'super_admin'
    }
  ].filter((tile) => tile.show);

  const displayName = user?.display_name || user?.full_name || user?.email || t('home.guest', 'Külaline');
  const roleLabels = {
    super_admin: 'Superadmin',
    admin: 'Admin',
    trainer: 'Treener',
    user: 'Mängija'
  };
  const roleLabel = roleLabels[userRole] || roleLabels.user;
  const firstName = React.useMemo(() => {
    const baseName = user?.display_name || user?.full_name || user?.email || t('home.guest', 'Guest');
    return baseName.split(' ')[0];
  }, [user, t]);

  const getTileClassName = (base, extra = '') => `${base}${extra}`;

  const renderTileLink = (tile, className, content) => {
    if (tile.to) {
      return (
        <Link key={tile.key} to={tile.to} className={className}>
          {content}
        </Link>
      );
    }
    if (tile.href) {
      return (
        <button key={tile.key} type="button" onClick={() => (window.location.href = tile.href)} className={className}>
          {content}
        </button>
      );
    }
    return (
      <button key={tile.key} type="button" onClick={tile.onClick} className={className}>
        {content}
      </button>
    );
  };

  const startPlayingTiles = React.useMemo(() => {
    const preferred = ['host', 'join', 'training-join', 'solo'];
    const selected = [];
    preferred.forEach((key) => {
      const tile = homeTiles.find((entry) => entry.key === key);
      if (tile) selected.push(tile);
    });
    if (selected.length < 4) {
      homeTiles.forEach((tile) => {
        if (selected.length >= 4) return;
        if (!selected.some((entry) => entry.key === tile.key)) selected.push(tile);
      });
    }
    return selected.slice(0, 4);
  }, [homeTiles]);

  const utilityTiles = React.useMemo(
    () => homeTiles.filter((tile) => !startPlayingTiles.some((entry) => entry.key === tile.key)),
    [homeTiles, startPlayingTiles]
  );

  const dashboardLinks = [
    { label: 'Dashboard', to: createPageUrl('Home'), active: true, icon: Sparkles },
    { label: 'Games', to: canManageGames ? createPageUrl('ManageGames') : `${createPageUrl('Home')}?mode=join`, icon: Gamepad2 },
    { label: 'Training', to: createPageUrl('JoinTraining'), icon: GraduationCap },
    { label: 'Records', to: createPageUrl('PuttingRecordsPage'), icon: Trophy },
    { label: 'Courses', to: canManageTraining ? createPageUrl('TrainerGroups') : createPageUrl('Profile'), icon: BookOpen }
  ];

  const formatRelativeDate = React.useCallback((dateValue) => {
    const value = new Date(dateValue).getTime();
    if (!Number.isFinite(value)) return 'Recently';
    const days = Math.floor((Date.now() - value) / (1000 * 60 * 60 * 24));
    if (days <= 0) return 'Today';
    if (days === 1) return '1 day ago';
    if (days < 7) return `${days} days ago`;
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  }, []);

  const summaryStats = React.useMemo(() => {
    const playerKeys = [user?.display_name, user?.full_name, user?.email].filter(Boolean);
    let totalThrows = 0;
    let scoreSum = 0;
    let scoreCount = 0;
    let trainingSessions = 0;

    const sorted = [...homeGames].sort((a, b) => new Date(b.date || b.created_date || 0) - new Date(a.date || a.created_date || 0));
    sorted.forEach((game) => {
      if ((game?.game_type || '').includes('training')) trainingSessions += 1;
      const key =
        playerKeys.find((entry) => game?.player_putts?.[entry] || game?.total_points?.[entry] !== undefined)
        || playerKeys[0];
      const putts = Array.isArray(game?.player_putts?.[key]) ? game.player_putts[key] : [];
      totalThrows += putts.length;
      const score = Number(game?.total_points?.[key]);
      if (Number.isFinite(score)) {
        scoreSum += score;
        scoreCount += 1;
      }
    });

    return {
      gamesPlayed: sorted.length,
      tournaments: sorted.filter((game) => game?.status === 'completed').length,
      totalThrows,
      avgScore: scoreCount > 0 ? (scoreSum / scoreCount).toFixed(1) : '0.0',
      trainingSessions
    };
  }, [homeGames, user]);

  const recentActivity = React.useMemo(() => {
    const items = [...homeGames]
      .sort((a, b) => new Date(b.date || b.created_date || 0) - new Date(a.date || a.created_date || 0))
      .slice(0, 3)
      .map((game) => {
        const typeMap = {
          classic: { title: 'Group Game', icon: Users },
          around_the_world: { title: 'Training Session', icon: GraduationCap },
          time_ladder: { title: 'Skill Session', icon: Trophy }
        };
        const match = typeMap[game?.game_type] || { title: 'Recent Session', icon: Trophy };
        return {
          id: game.id,
          title: match.title,
          subtitle: game?.name || 'Disc golf session',
          ago: formatRelativeDate(game?.date || game?.created_date),
          icon: match.icon
        };
      });
    if (items.length === 0) {
      return [
        { id: 'mock-1', title: '1st Place', subtitle: 'Spring Tournament', ago: '2 days ago', icon: Trophy },
        { id: 'mock-2', title: 'Training Session', subtitle: 'Putting Practice', ago: '5 days ago', icon: GraduationCap },
        { id: 'mock-3', title: 'Group Game', subtitle: 'Oak Valley Course', ago: '1 week ago', icon: Users }
      ];
    }
    return items;
  }, [homeGames, formatRelativeDate]);

  const chartValues = React.useMemo(() => {
    const values = [...homeGames]
      .sort((a, b) => new Date(a.date || a.created_date || 0) - new Date(b.date || b.created_date || 0))
      .slice(-7)
      .map((game) => {
        const scoreValues = Object.values(game?.total_points || {})
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value));
        if (scoreValues.length === 0) return null;
        return scoreValues.reduce((acc, value) => acc + value, 0) / scoreValues.length;
      })
      .filter((value) => value !== null);

    if (values.length < 4) return [56, 50, 64, 42, 58, 36, 60];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    return values.map((value) => 34 + ((value - min) / range) * 44);
  }, [homeGames]);

  const chartPoints = chartValues
    .map((value, index) => {
      const x = chartValues.length === 1 ? 50 : (index / (chartValues.length - 1)) * 100;
      const y = 100 - value;
      return `${x},${y}`;
    })
    .join(' ');

  const skillProgress = React.useMemo(() => {
    const accuracy = summaryStats.totalThrows > 0
      ? Math.min(98, Math.round((summaryStats.tournaments / Math.max(summaryStats.gamesPlayed, 1)) * 100 + 62))
      : 79;
    const putting = Math.min(96, Math.max(62, Math.round(accuracy - 4)));
    const driving = Math.min(97, Math.max(60, Math.round(putting + 4)));
    const approach = Math.min(95, Math.max(58, Math.round((driving + accuracy) / 2 - 3)));
    return [
      { label: 'Driving', value: driving },
      { label: 'Putting', value: putting },
      { label: 'Approach', value: approach },
      { label: 'Accuracy', value: accuracy }
    ];
  }, [summaryStats]);

  const achievements = [
    {
      key: 'tournament',
      title: 'Tournament Winner',
      subtitle: 'Spring Classic',
      active: summaryStats.tournaments > 0,
      tone: 'teal'
    },
    {
      key: 'century',
      title: 'Century Club',
      subtitle: `${summaryStats.gamesPlayed} Games`,
      active: summaryStats.gamesPlayed >= 25,
      tone: 'amber'
    },
    {
      key: 'ace',
      title: 'Ace Master',
      subtitle: '5 Aces',
      active: summaryStats.gamesPlayed >= 10,
      tone: 'muted'
    },
    {
      key: 'streak',
      title: 'Hot Streak',
      subtitle: '10 Wins',
      active: summaryStats.trainingSessions >= 5,
      tone: 'muted'
    }
  ];

  const renderStartTile = (tile, index) => {
    const theme = tileThemes[tile.color] || tileThemes.emerald;
    const Icon = tile.icon;
    const isPrimary = index === 0;
    const content = (
      <div className="flex flex-col items-start gap-3">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${isPrimary ? 'bg-white/20 text-white' : `${theme.bg} ${theme.icon}`}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className={`text-[28px] leading-7 font-semibold tracking-tight ${isPrimary ? 'text-white' : 'text-slate-800 dark:text-slate-100'}`}>{tile.label}</div>
          <div className={`mt-1 text-sm ${isPrimary ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>{tile.sub}</div>
        </div>
      </div>
    );
    const tileClassName = isPrimary
      ? 'rounded-2xl bg-gradient-to-br from-[#137b84] to-[#1db6a9] p-5 text-left shadow-fp-soft transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300'
      : 'rounded-2xl border border-[#d7e4e8] bg-white p-5 text-left shadow-fp-card transition hover:-translate-y-0.5 hover:shadow-fp-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 dark:bg-black dark:border-[#14363f]';
    return renderTileLink(tile, tileClassName, content);
  };

  const renderUtilityTile = (tile) => {
    const theme = tileThemes[tile.color] || tileThemes.emerald;
    const Icon = tile.icon;
    const content = (
      <div className="flex items-center gap-4">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ${theme.bg} ${theme.ring} shadow-sm ${theme.glow}`}>
          <Icon className={`h-6 w-6 ${theme.icon}`} />
        </div>
        <div className="min-w-0 text-left">
          <div className="truncate text-base font-semibold leading-tight text-slate-800 dark:text-slate-100">{tile.label}</div>
          <div className="text-sm leading-tight text-slate-500 dark:text-slate-400">{tile.sub}</div>
        </div>
      </div>
    );

    const tileClassName = getTileClassName(
      'w-full rounded-2xl border border-[#d7e4e8] bg-white p-4 shadow-fp-card transition hover:-translate-y-0.5 hover:shadow-fp-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 dark:bg-black dark:border-[#14363f]',
      tile.hideOnMobile ? ' hidden md:block' : ''
    );
    return renderTileLink(tile, tileClassName, content);
  };

  const renderAchievement = (item) => {
    const toneClasses = item.tone === 'teal'
      ? 'bg-gradient-to-br from-[#137b84] to-[#1db6a9] text-white'
      : item.tone === 'amber'
        ? 'bg-gradient-to-br from-[#e6a11f] to-[#ffbf3f] text-white'
        : 'bg-[#eceef2] text-slate-500 dark:bg-[#061a20] dark:text-slate-300';
    return (
      <div
        key={item.key}
        className={`rounded-2xl px-4 py-5 text-center transition ${item.active ? toneClasses : 'bg-[#eceef2] text-slate-500 dark:bg-[#061a20] dark:text-slate-300'}`}
      >
        <div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-white/20">
          <Trophy className="h-4 w-4" />
        </div>
        <div className="text-sm font-semibold">{item.title}</div>
        <div className="text-xs opacity-80">{item.subtitle}</div>
      </div>
    );
  };


  const handleHostGame = async (gameData) => {
    const user = await base44.auth.me();
    const gameType = gameData.gameType || 'classic';
    const format = GAME_FORMATS[gameType];

    const game = await base44.entities.Game.create({
      name: gameData.name,
      pin: gameData.pin,
      game_type: gameType,
      putt_type: gameData.puttType || 'regular',
      host_user: user.email,
      players: [],
      player_distances: {},
      player_putts: {},
      total_points: {},
      player_uids: {},
      player_emails: {},
      join_closed: false,
      status: 'active',
      date: new Date().toISOString()
    });

    setGameId(game.id);
    setMode('host');
    window.history.replaceState({}, '', `${createPageUrl('Home')}?mode=host&gameId=${game.id}`);
  };

  const handleJoinGame = ({ game, playerName }) => {
    setGameId(game.id);
    setPlayerName(playerName);
    
    // Check if this is an ATW game
    if (game.game_type === 'around_the_world') {
      setMode('atw-game');
      setIsSoloATW(game.pin === '0000');
      window.history.replaceState({}, '', `${createPageUrl('Home')}?mode=atw-game&gameId=${game.id}`);
    } else {
      setMode('player');
      window.history.replaceState({}, '', `${createPageUrl('Home')}?mode=player&gameId=${game.id}`);
    }
  };

  // Initial selection screen
  if (!mode) {
    return (
      <div className="min-h-screen bg-[#17191b] px-2 py-3 sm:px-4 sm:py-7 dark:bg-black">
        <div className="mx-auto w-full max-w-[1220px] overflow-hidden rounded-[18px] border border-[#d9dee2] bg-[#f3f4f5] shadow-[0_30px_80px_rgba(0,0,0,0.35)] dark:border-[#14363f] dark:bg-black">
          <header className="border-b border-[#e5e9ec] bg-white px-4 py-3 sm:px-6 dark:border-[#14363f] dark:bg-black">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="text-[30px] font-semibold leading-none text-[#1b2639] dark:text-slate-100">Wisedisc</div>
                <nav className="ml-4 hidden items-center gap-1 lg:flex">
                  {dashboardLinks.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.label}
                        to={item.to}
                        className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                          item.active
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
                      <span>{t('home.profile', 'Minu profiil')}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => navigate(createPageUrl('PuttingRecordsPage'))}>
                      <BarChart3 className="h-4 w-4 text-slate-500" />
                      <span>{t('home.records', 'Rekordid')}</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <div className="flex items-center justify-between px-2 py-2">
                      <LanguageToggle />
                      <ThemeToggle />
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={handleLogout} className="text-red-600 dark:text-red-400">
                      <LogOut className="h-4 w-4" />
                      <span>{t('home.logout', 'Logi välja')}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-1 overflow-auto pb-1 lg:hidden">
              {dashboardLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    to={item.to}
                    className={`inline-flex items-center gap-1 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-medium ${
                      item.active
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
            <section>
              <h1 className="text-3xl font-bold tracking-tight text-[#1b2639] sm:text-[50px] sm:leading-[56px] dark:text-slate-100">
                Welcome back, {firstName}!
              </h1>
              <p className="mt-2 text-sm text-slate-500 sm:text-xl dark:text-slate-300">
                Here&apos;s what&apos;s happening with your disc golf journey today.
              </p>
            </section>

            <section className="mt-6 grid gap-4 xl:grid-cols-[2.1fr_1fr]">
              <div className="rounded-[24px] border border-[#dde4e8] bg-white p-5 shadow-fp-card dark:border-[#14363f] dark:bg-black">
                <h2 className="text-[30px] font-semibold leading-8 text-[#233246] dark:text-slate-100">Your Statistics</h2>
                <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <div className="rounded-2xl bg-[#d8f3ef] px-4 py-4 text-center dark:bg-black">
                    <div className="text-[34px] font-semibold leading-8 text-[#167f74] dark:text-slate-100">{summaryStats.gamesPlayed}</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Games Played</div>
                  </div>
                  <div className="rounded-2xl bg-[#fef2dd] px-4 py-4 text-center dark:bg-black">
                    <div className="text-[34px] font-semibold leading-8 text-[#d79421] dark:text-slate-100">{summaryStats.tournaments}</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Tournaments</div>
                  </div>
                  <div className="rounded-2xl bg-[#e6f2f2] px-4 py-4 text-center dark:bg-black">
                    <div className="text-[34px] font-semibold leading-8 text-[#177f89] dark:text-slate-100">{summaryStats.totalThrows}</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Total Throws</div>
                  </div>
                  <div className="rounded-2xl bg-[#eff1f4] px-4 py-4 text-center dark:bg-black">
                    <div className="text-[34px] font-semibold leading-8 text-[#223248] dark:text-slate-100">-{summaryStats.avgScore}</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Avg Score</div>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="mb-2 text-center text-xs text-slate-500 dark:text-slate-400">Weekly Performance</div>
                  <div className="rounded-2xl bg-[#e0f0ef] px-3 py-3 dark:bg-black">
                    <svg viewBox="0 0 100 100" className="h-32 w-full" preserveAspectRatio="none">
                      <line x1="0" y1="20" x2="100" y2="20" stroke="#c5d9dc" strokeWidth="0.8" />
                      <line x1="0" y1="40" x2="100" y2="40" stroke="#c5d9dc" strokeWidth="0.8" />
                      <line x1="0" y1="60" x2="100" y2="60" stroke="#c5d9dc" strokeWidth="0.8" />
                      <line x1="0" y1="80" x2="100" y2="80" stroke="#c5d9dc" strokeWidth="0.8" />
                      <polyline fill="none" stroke="#1db6a9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={chartPoints} />
                    </svg>
                    <div className="mt-1 grid grid-cols-7 text-center text-[10px] text-slate-500 dark:text-slate-400">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                        <span key={day}>{day}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-[#dde4e8] bg-white p-5 shadow-fp-card dark:border-[#14363f] dark:bg-black">
                <h2 className="text-[30px] font-semibold leading-8 text-[#233246] dark:text-slate-100">Recent Activity</h2>
                <div className="mt-4 space-y-3">
                  {recentActivity.map((item, index) => {
                    const ItemIcon = item.icon;
                    return (
                      <div
                        key={item.id}
                        className={`flex items-start gap-3 pb-3 ${index < recentActivity.length - 1 ? 'border-b border-[#e4e9ec] dark:border-[#14363f]' : ''}`}
                      >
                        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[#ebeff2] text-[#5d6879] dark:bg-black dark:text-slate-300">
                          <ItemIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[#1e2f44] dark:text-slate-100">{item.title}</div>
                          <div className="truncate text-xs text-slate-500 dark:text-slate-400">{item.subtitle}</div>
                          <div className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{item.ago}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="mt-8">
              <h2 className="text-3xl font-semibold leading-8 text-[#233246] dark:text-slate-100">Start Playing</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {startPlayingTiles.map((tile, index) => renderStartTile(tile, index))}
              </div>
            </section>

            <section className="mt-5 grid gap-4 xl:grid-cols-2">
              <div className="rounded-[24px] border border-[#dde4e8] bg-white p-5 shadow-fp-card dark:border-[#14363f] dark:bg-black">
                <h3 className="text-[28px] font-semibold leading-8 text-[#233246] dark:text-slate-100">Skill Progress</h3>
                <div className="mt-4 space-y-3">
                  {skillProgress.map((item) => (
                    <div key={item.label}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium text-[#3a4b63] dark:text-slate-200">{item.label}</span>
                        <span className="font-semibold text-[#198f84] dark:text-slate-100">{item.value}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-[#ecf0f2] dark:bg-black">
                        <div
                          className="h-2 rounded-full bg-[#1db6a9] transition-all duration-300"
                          style={{ width: `${item.value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-xl bg-[#e3f5f1] px-3 py-2 text-xs text-[#2f5f60] dark:bg-black dark:text-slate-300">
                  Tip of the Day: Focus on your putting consistency to improve overall score.
                </div>
              </div>

              <div className="rounded-[24px] border border-[#dde4e8] bg-white p-5 shadow-fp-card dark:border-[#14363f] dark:bg-black">
                <h3 className="text-[28px] font-semibold leading-8 text-[#233246] dark:text-slate-100">Recent Achievements</h3>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {achievements.map(renderAchievement)}
                </div>
              </div>
            </section>

            {utilityTiles.length > 0 && (
              <section className="mt-5">
                <h3 className="text-[28px] font-semibold leading-8 text-[#233246] dark:text-slate-100">More Tools</h3>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {utilityTiles.map(renderUtilityTile)}
                </div>
              </section>
            )}

            <div className="mt-5 flex justify-end">
              <VersionBadge inline />
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Host setup
  if (mode === 'host-setup') {
    return <HostSetup onStartGame={handleHostGame} onBack={goHome} />;
  }

  // Solo mode
  if (mode === 'solo') {
    return <HostSetup onStartGame={async (gameData) => {
      const user = await base44.auth.me();
      const game = await base44.entities.Game.create({
        name: gameData.name || t('home.solo', 'Soolotreening'),
        pin: '0000',
        game_type: gameData.gameType || 'classic',
        putt_type: gameData.puttType || 'regular',
        host_user: user.email,
        players: [user.full_name],
        player_distances: { [user.full_name]: GAME_FORMATS[gameData.gameType || 'classic'].startDistance },
        player_putts: { [user.full_name]: [] },
        total_points: { [user.full_name]: 0 },
        player_uids: { [user.full_name]: user.id },
        player_emails: { [user.full_name]: user.email },
        join_closed: false,
        status: 'active',
        date: new Date().toISOString()
      });
      setGameId(game.id);
      setPlayerName(user.full_name);
      setMode('player');
      window.history.replaceState({}, '', `${createPageUrl('Home')}?mode=player&gameId=${game.id}`);
    }} onBack={goHome} isSolo={true} />;
  }

  // Join game
  if (mode === 'join') {
    return <JoinGame onJoin={handleJoinGame} onBack={goHome} />;
  }

  // Host view
  if (mode === 'host') {
    return <HostView gameId={gameId} onExit={goHome} />;
  }

  // Player view
  if (mode === 'player') {
    const handlePlayerExit = () => {
      if (playerReturnTo === 'training') {
        navigate(createPageUrl('JoinTraining'));
        return;
      }
      goHome();
    };
    return <PlayerView gameId={gameId} playerName={playerName} onExit={handlePlayerExit} />;
  }

  // Around the World setup
  if (mode === 'atw-setup') {
    return (
      <AroundTheWorldSetup
        isSolo={isSoloATW}
        initialPin={atwPin}
        initialName={atwName}
        initialPuttType={atwPuttType}
        onBack={() => {
          setAtwPin(null);
          setAtwName(null);
          setAtwPuttType(null);
          goHome();
        }}
        onStart={async (setupData) => {
          const user = await base44.auth.me();
          const playerName = user?.display_name || user?.full_name || user?.email || t('home.guest', 'Player');

          const game = await base44.entities.Game.create({
            name: setupData.name,
            pin: isSoloATW ? '0000' : setupData.pin,
            game_type: setupData.gameType,
            putt_type: setupData.puttType || 'regular',
            host_user: user.email,
            players: isSoloATW ? [playerName] : [],
            player_distances: {},
            player_putts: {},
            total_points: {},
            player_uids: isSoloATW ? { [playerName]: user.id } : {},
            player_emails: isSoloATW ? { [playerName]: user.email } : {},
            join_closed: false,
            status: 'active',
            date: new Date().toISOString(),
            atw_config: setupData.config,
            atw_state: isSoloATW ? {
              [playerName]: {
                current_distance_index: 0,
                direction: 'UP',
                laps_completed: 0,
                turns_played: 0,
                total_makes: 0,
                total_putts: 0,
                current_distance_points: 0,
                current_round_draft: { attempts: [], is_finalized: false },
                history: [],
                best_score: 0,
                best_laps: 0,
                best_accuracy: 0,
                attempts_count: 0
              }
            } : {}
          });
          
          setGameId(game.id);
          if (isSoloATW) {
            setPlayerName(playerName);
            setMode('atw-game');
            window.history.replaceState({}, '', `${createPageUrl('Home')}?mode=atw-game&gameId=${game.id}`);
          } else {
            setMode('atw-host');
            window.history.replaceState({}, '', `${createPageUrl('Home')}?mode=atw-host&gameId=${game.id}`);
          }
        }}
      />
    );
  }

  if (mode === 'time-ladder-setup') {
    return (
      <TimeLadderSetup
        isSolo
        initialName={timeLadderName}
        initialPuttType={timeLadderPuttType}
        onBack={() => {
          setTimeLadderName(null);
          setTimeLadderPuttType(null);
          goHome();
        }}
        onStart={async (setupData) => {
          const user = await base44.auth.me();
          const playerName = user?.display_name || user?.full_name || user?.email || t('home.guest', 'Player');

          const game = await base44.entities.Game.create({
            name: setupData.name,
            pin: '0000',
            game_type: setupData.gameType,
            putt_type: setupData.puttType || 'regular',
            host_user: user.email,
            players: [playerName],
            player_distances: { [playerName]: 5 },
            player_putts: { [playerName]: [] },
            total_points: { [playerName]: 0 },
            player_current_streaks: { [playerName]: 0 },
            player_uids: { [playerName]: user.id },
            player_emails: { [playerName]: user.email },
            join_closed: false,
            status: 'active',
            date: new Date().toISOString(),
            time_ladder_config: setupData.config
          });

          setGameId(game.id);
          setPlayerName(playerName);
          setMode('player');
          window.history.replaceState({}, '', `${createPageUrl('Home')}?mode=player&gameId=${game.id}`);
        }}
      />
    );
  }

  // Around the World host view
  if (mode === 'atw-host') {
    return <HostView gameId={gameId} onExit={goHome} />;
  }

  // Around the World game view
  if (mode === 'atw-game') {
    return (
      <AroundTheWorldGameView
        gameId={gameId}
        playerName={playerName}
        isSolo={isSoloATW}
      />
    );
  }

  return null;
}
