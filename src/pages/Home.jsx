import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Users, UserPlus, Settings, User, Target, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

import HostSetup from '@/components/putting/HostSetup';
import JoinGame from '@/components/putting/JoinGame';
import HostView from '@/components/putting/HostView';
import PlayerView from '@/components/putting/PlayerView';
import AroundTheWorldSetup from '@/components/putting/AroundTheWorldSetup';
import AroundTheWorldGameView from '@/components/putting/AroundTheWorldGameView';
import { GAME_FORMATS } from '@/components/putting/gameRules';

export default function Home() {
  const [mode, setMode] = useState(null); // null, 'host', 'player', 'atw-setup', 'atw-game', 'atw-host'
  const [gameId, setGameId] = useState(null);
  const [playerName, setPlayerName] = useState(null);
  const [isSoloATW, setIsSoloATW] = useState(false);
  const [atwPin, setAtwPin] = useState(null);
  const [atwName, setAtwName] = useState(null);
  const [atwPuttType, setAtwPuttType] = useState(null);

  // Check URL params for ATW mode and continuing games
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlMode = params.get('mode');
    const isSolo = params.get('solo') === '1';
    const urlGameId = params.get('gameId');

    if (urlMode === 'atw-setup') {
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
          const playerName = user?.display_name || user?.full_name || user?.email || 'Player';
          setPlayerName(playerName);
          setMode('atw-game');
        });
      });
    } else if (urlMode === 'player' && urlGameId) {
      // Continue regular game from profile
      setGameId(urlGameId);
      base44.auth.me().then(user => {
        const playerName = user?.display_name || user?.full_name || user?.email || 'Player';
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
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white p-4">
        <div className="max-w-lg mx-auto pt-16">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-slate-800 mb-2">
              Welcome {user?.display_name || user?.full_name || 'Guest'}!
            </h1>
            <p className="text-slate-600 text-xl mb-8">Ready to make some putts?</p>
          </div>

          <div className="space-y-4">
            {canHostGames && (
              <button
                onClick={() => setMode('host-setup')}
                className="w-full bg-white rounded-2xl p-6 shadow-sm border-2 border-slate-200 hover:border-emerald-400 hover:shadow-lg transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                    <Users className="w-7 h-7 text-emerald-600" />
                  </div>
                  <div className="text-left flex-1">
                    <h3 className="text-lg font-bold text-slate-800">Host Game</h3>
                    <p className="text-sm text-slate-500">Create a session and get a PIN</p>
                  </div>
                </div>
              </button>
            )}

            <button
              onClick={() => setMode('join')}
              className="w-full bg-white rounded-2xl p-6 shadow-sm border-2 border-slate-200 hover:border-emerald-400 hover:shadow-lg transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                  <UserPlus className="w-7 h-7 text-emerald-600" />
                </div>
                <div className="text-left flex-1">
                  <h3 className="text-lg font-bold text-slate-800">Join Game</h3>
                  <p className="text-sm text-slate-500">Enter a PIN to join a session</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setMode('solo')}
              className="w-full bg-white rounded-2xl p-6 shadow-sm border-2 border-slate-200 hover:border-emerald-400 hover:shadow-lg transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                  <Target className="w-7 h-7 text-emerald-600" />
                </div>
                <div className="text-left flex-1">
                  <h3 className="text-lg font-bold text-slate-800">Solo Practice</h3>
                  <p className="text-sm text-slate-500">Practice alone without hosting</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => window.location.href = createPageUrl('PuttingRecordsPage')}
              className="w-full bg-white rounded-2xl p-6 shadow-sm border-2 border-slate-200 hover:border-amber-400 hover:shadow-lg transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center group-hover:bg-amber-200 transition-colors">
                  <Trophy className="w-7 h-7 text-amber-600" />
                </div>
                <div className="text-left flex-1">
                  <h3 className="text-lg font-bold text-slate-800">Putting Records</h3>
                  <p className="text-sm text-slate-500">View leaderboards and top scores</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => window.location.href = createPageUrl('PuttingKing')}
              className="w-full bg-white rounded-2xl p-6 shadow-sm border-2 border-slate-200 hover:border-purple-400 hover:shadow-lg transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                  <Trophy className="w-7 h-7 text-purple-600" />
                </div>
                <div className="text-left flex-1">
                  <h3 className="text-lg font-bold text-slate-800">Putting King</h3>
                  <p className="text-sm text-slate-500">Join tournaments and compete</p>
                </div>
              </div>
            </button>



            <div className="pt-8 border-t-2 border-slate-200 mt-8 space-y-3">
            {canManageGames && (
              <Link
                to={createPageUrl('ManageGames')}
                className="w-full bg-white rounded-2xl p-5 shadow-sm border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all group block"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center group-hover:bg-slate-200 transition-colors">
                    <Settings className="w-6 h-6 text-slate-600" />
                  </div>
                  <div className="text-left flex-1">
                    <h3 className="text-base font-bold text-slate-800">Manage Games</h3>
                    <p className="text-xs text-slate-500">View and organize your games</p>
                  </div>
                </div>
              </Link>
            )}

            <Link
              to={createPageUrl('Profile')}
              className="w-full bg-white rounded-2xl p-5 shadow-sm border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all group block"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center group-hover:bg-slate-200 transition-colors">
                  <User className="w-6 h-6 text-slate-600" />
                </div>
                <div className="text-left flex-1">
                  <h3 className="text-base font-bold text-slate-800">My Profile</h3>
                  <p className="text-xs text-slate-500">Stats and game history</p>
                </div>
              </div>
            </Link>

            {userRole === 'super_admin' && (
              <Link
                to={createPageUrl('AdminUsers')}
                className="w-full bg-white rounded-2xl p-5 shadow-sm border border-red-200 hover:border-red-300 hover:shadow-md transition-all group block"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center group-hover:bg-red-200 transition-colors">
                    <User className="w-6 h-6 text-red-600" />
                  </div>
                  <div className="text-left flex-1">
                    <h3 className="text-base font-bold text-slate-800">User Management</h3>
                    <p className="text-xs text-slate-500">Manage roles and permissions</p>
                  </div>
                </div>
              </Link>
            )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Host setup
  if (mode === 'host-setup') {
    return <HostSetup onStartGame={handleHostGame} onBack={() => setMode(null)} />;
  }

  // Solo mode
  if (mode === 'solo') {
    return <HostSetup onStartGame={async (gameData) => {
      const user = await base44.auth.me();
      const game = await base44.entities.Game.create({
        name: gameData.name || 'Solo Practice',
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
        status: 'active',
        date: new Date().toISOString()
      });
      setGameId(game.id);
      setPlayerName(user.full_name);
      setMode('player');
    }} onBack={() => setMode(null)} isSolo={true} />;
  }

  // Join game
  if (mode === 'join') {
    return <JoinGame onJoin={handleJoinGame} onBack={() => setMode(null)} />;
  }

  // Host view
  if (mode === 'host') {
    return <HostView gameId={gameId} onExit={() => setMode(null)} />;
  }

  // Player view
  if (mode === 'player') {
    return <PlayerView gameId={gameId} playerName={playerName} onExit={() => setMode(null)} />;
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
          setMode(null);
          setAtwPin(null);
          setAtwName(null);
          setAtwPuttType(null);
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

  // Around the World host view
  if (mode === 'atw-host') {
    return <HostView gameId={gameId} onExit={() => setMode(null)} />;
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
