import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Users, UserPlus, Settings, User, Target, Trophy, Crown, Shield, LogOut, GraduationCap, Users2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
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

export default function Home() {
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

  const goHome = React.useCallback(() => {
    setMode(null);
    window.history.replaceState({}, '', createPageUrl('Home'));
  }, []);

  const handleLogout = React.useCallback(async () => {
    await base44.auth.logout(true);
  }, []);

  const setSimpleMode = React.useCallback((nextMode) => {
    setMode(nextMode);
    window.history.replaceState({}, '', `${createPageUrl('Home')}?mode=${nextMode}`);
  }, []);

  // Check URL params for ATW mode and continuing games
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
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
          const playerName = user?.display_name || user?.full_name || user?.email || 'Mängija';
          setPlayerName(playerName);
          setMode('atw-game');
        });
      });
    } else if (urlMode === 'player' && urlGameId) {
      // Continue regular game from profile
      setGameId(urlGameId);
      setPlayerReturnTo(urlFrom === 'training' ? 'training' : 'home');
      base44.auth.me().then(user => {
        const playerName = user?.display_name || user?.full_name || user?.email || 'Mängija';
        setPlayerName(playerName);
        setMode('player');
      });
    }
  }, []);

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
    : 'Liitu trenniga';
  const trainingSub = trainingGroups.length ? 'Trenn' : 'Sisesta PIN';

  const tileThemes = {
    emerald: { bg: 'bg-emerald-100 dark:bg-black', icon: 'text-emerald-600', ring: 'ring-emerald-200 dark:ring-emerald-500/40', glow: 'shadow-emerald-100/60 dark:shadow-emerald-500/10' },
    sky: { bg: 'bg-sky-100 dark:bg-black', icon: 'text-sky-600', ring: 'ring-sky-200 dark:ring-sky-500/40', glow: 'shadow-sky-100/60 dark:shadow-sky-500/10' },
    amber: { bg: 'bg-amber-100 dark:bg-black', icon: 'text-amber-600', ring: 'ring-amber-200 dark:ring-amber-500/40', glow: 'shadow-amber-100/60 dark:shadow-amber-500/10' },
    purple: { bg: 'bg-purple-100 dark:bg-black', icon: 'text-purple-600', ring: 'ring-purple-200 dark:ring-purple-500/40', glow: 'shadow-purple-100/60 dark:shadow-purple-500/10' },
    blue: { bg: 'bg-blue-100 dark:bg-black', icon: 'text-blue-600', ring: 'ring-blue-200 dark:ring-blue-500/40', glow: 'shadow-blue-100/60 dark:shadow-blue-500/10' },
    slate: { bg: 'bg-slate-100 dark:bg-black', icon: 'text-slate-600', ring: 'ring-slate-200 dark:ring-white/20', glow: 'shadow-slate-100/60 dark:shadow-white/5' },
    red: { bg: 'bg-red-100 dark:bg-black', icon: 'text-red-600', ring: 'ring-red-200 dark:ring-red-500/40', glow: 'shadow-red-100/60 dark:shadow-red-500/10' }
  };

  const homeTiles = [
    {
      key: 'host',
      label: 'Hosti mäng',
      sub: 'Loo sessioon',
      icon: Users,
      color: 'emerald',
      onClick: () => setSimpleMode('host-setup'),
      show: canHostGames
    },
    {
      key: 'join',
      label: 'Liitu mänguga',
      sub: 'Sisesta PIN',
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
      label: 'Soolotreening',
      sub: 'Harjuta üksi',
      icon: Target,
      color: 'emerald',
      onClick: () => setSimpleMode('solo'),
      show: true
    },
    {
      key: 'records',
      label: 'Rekordid',
      sub: 'Edetabelid',
      icon: Trophy,
      color: 'amber',
      href: createPageUrl('PuttingRecordsPage'),
      show: true
    },
    {
      key: 'king',
      label: 'Kuningas',
      sub: 'Turniirid',
      icon: Crown,
      color: 'purple',
      href: createPageUrl('PuttingKing'),
      show: FEATURE_FLAGS.puttingKing
    },
    {
      key: 'profile',
      label: 'Minu profiil',
      sub: 'Statistika',
      icon: User,
      color: 'slate',
      to: createPageUrl('Profile'),
      show: true
    },
    {
      key: 'manage',
      label: 'Halda mänge',
      sub: 'Admin',
      icon: Settings,
      color: 'blue',
      to: createPageUrl('ManageGames'),
      show: canManageGames
    },
    {
      key: 'trainer',
      label: 'Treener',
      sub: 'Grupid & projektor',
      icon: Users2,
      color: 'amber',
      to: createPageUrl('TrainerGroups'),
      show: canManageTraining && showTrainingFeatures
    },
    {
      key: 'admin',
      label: 'Kasutajad',
      sub: 'Superadmin',
      icon: Shield,
      color: 'red',
      to: createPageUrl('AdminUsers'),
      show: userRole === 'super_admin'
    }
  ].filter((tile) => tile.show);

  const renderTile = (tile) => {
    const theme = tileThemes[tile.color] || tileThemes.emerald;
    const Icon = tile.icon;
    const content = (
      <div className="flex flex-col items-center gap-2">
        <div className={`flex h-16 w-16 items-center justify-center rounded-[22px] ring-1 ${theme.bg} ${theme.ring} shadow-sm ${theme.glow}`}>
          <Icon className={`h-7 w-7 ${theme.icon}`} />
        </div>
        <div className="text-center">
          <div className="text-[12px] font-semibold text-slate-800 leading-tight dark:text-slate-100">{tile.label}</div>
          <div className="text-[10px] text-slate-500 leading-tight dark:text-slate-400">{tile.sub}</div>
        </div>
      </div>
    );

    const className =
      "w-full rounded-[28px] border border-white/70 bg-white/70 p-3 shadow-[0_8px_24px_rgba(15,23,42,0.08)] backdrop-blur-sm transition hover:-translate-y-1 hover:shadow-[0_16px_32px_rgba(15,23,42,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 dark:bg-black dark:border-white/10";

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
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_rgba(255,255,255,1)_55%)] px-4 dark:bg-black dark:text-slate-100">
        <div className="max-w-2xl mx-auto pt-10 pb-12">
          <div className="flex justify-end mb-4 gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm backdrop-blur-sm transition hover:bg-white"
            >
              <LogOut className="w-4 h-4" />
              Logi välja
            </button>
          </div>
          <div className="text-center mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-2">
              Tere tulemast, {user?.display_name || user?.full_name || 'Külaline'}!
            </h1>
            <p className="text-slate-600 text-base sm:text-lg">Valmis puttama?</p>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 sm:gap-5">
            {homeTiles.map(renderTile)}
          </div>
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
        name: gameData.name || 'Soolotreening',
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
          const playerName = user?.display_name || user?.full_name || user?.email || 'Player';

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
          const playerName = user?.display_name || user?.full_name || user?.email || 'Player';

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
