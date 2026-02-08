import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, UserPlus, Settings, User, Target, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { db, auth } from '@/lib/firebase';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

import HostSetup from '@/components/putting/HostSetup';
import JoinGame from '@/components/putting/JoinGame';
import HostView from '@/components/putting/HostView';
import PlayerView from '@/components/putting/PlayerView';
import AroundTheWorldSetup from '@/components/putting/AroundTheWorldSetup';
import AroundTheWorldGameView from '@/components/putting/AroundTheWorldGameView';
import { GAME_FORMATS } from '@/components/putting/gameRules';

export default function Home() {
  const [mode, setMode] = useState(null);
  const [gameId, setGameId] = useState(null);
  const [playerName, setPlayerName] = useState(null);
  const [isSoloATW, setIsSoloATW] = useState(false);
  const [atwPin, setAtwPin] = useState(null);
  const [atwName, setAtwName] = useState(null);
  const [atwPuttType, setAtwPuttType] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        queryClient.setQueryData(['user'], user);
      } else {
        queryClient.setQueryData(['user'], null);
      }
    });
    return () => unsubscribe();
  }, [queryClient]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlMode = params.get('mode');
    const isSolo = params.get('solo') === '1';
    const urlGameId = params.get('gameId');

    if (urlMode === 'atw-setup') {
      setIsSoloATW(isSolo);
      setMode('atw-setup');
      const urlPin = params.get('pin');
      const urlName = params.get('name');
      const urlPuttType = params.get('puttType');
      if (urlPin) setAtwPin(urlPin);
      if (urlName) setAtwName(decodeURIComponent(urlName));
      if (urlPuttType) setAtwPuttType(urlPuttType);
    } else if (urlMode === 'atw-host' && urlGameId) {
      setGameId(urlGameId);
      setMode('atw-host');
    } else if (urlMode === 'host' && urlGameId) {
      setGameId(urlGameId);
      setMode('host');
    } else if (urlMode === 'atw-game' && urlGameId) {
      const gameRef = doc(db, 'games', urlGameId);
      getDoc(gameRef).then(docSnap => {
        if (docSnap.exists()) {
          const game = docSnap.data();
          setIsSoloATW(game.pin === '0000');
          const currentUser = auth.currentUser;
          if (currentUser) {
            setPlayerName(currentUser.displayName || currentUser.email || 'Mängija');
            setGameId(urlGameId);
            setMode('atw-game');
          }
        }
      });
    } else if (urlMode === 'player' && urlGameId) {
        const currentUser = auth.currentUser;
        if (currentUser) {
          setPlayerName(currentUser.displayName || currentUser.email || 'Mängija');
          setGameId(urlGameId);
          setMode('player');
        }
    }
  }, []);

  const { data: user } = useQuery({ queryKey: ['user'] });

  const handleHostGame = async (gameData) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const gameType = gameData.gameType || 'classic';
    const newGame = {
      name: gameData.name,
      pin: gameData.pin,
      game_type: gameType,
      putt_type: gameData.puttType || 'regular',
      host_user: currentUser.email,
      players: [],
      player_distances: {},
      player_putts: {},
      total_points: {},
      player_uids: {},
      player_emails: {},
      join_closed: false,
      status: 'active',
      date: new Date().toISOString(),
    };

    const docRef = await addDoc(collection(db, 'games'), newGame);
    setGameId(docRef.id);
    setMode('host');
    window.history.replaceState({}, '', `${createPageUrl('Home')}?mode=host&gameId=${docRef.id}`);
  };

  const handleJoinGame = ({ game, playerName }) => {
    setGameId(game.id);
    setPlayerName(playerName);
    
    if (game.game_type === 'around_the_world') {
      setMode('atw-game');
      setIsSoloATW(game.pin === '0000');
      window.history.replaceState({}, '', `${createPageUrl('Home')}?mode=atw-game&gameId=${game.id}`);
    } else {
      setMode('player');
      window.history.replaceState({}, '', `${createPageUrl('Home')}?mode=player&gameId=${game.id}`);
    }
  };

  if (!mode) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white p-4">
        <div className="max-w-lg mx-auto pt-16">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-slate-800 mb-2">
              Tere tulemast, {user?.displayName || 'Külaline'}!
            </h1>
            <p className="text-slate-600 text-xl mb-8">Valmis puttama?</p>
          </div>
          <div className="space-y-4">
              <button
                onClick={() => setMode('host-setup')}
                className="w-full bg-white rounded-2xl p-6 shadow-sm border-2 border-slate-200 hover:border-emerald-400 hover:shadow-lg transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                    <Users className="w-7 h-7 text-emerald-600" />
                  </div>
                  <div className="text-left flex-1">
                    <h3 className="text-lg font-bold text-slate-800">Hosti mäng</h3>
                    <p className="text-sm text-slate-500">Loo sessioon ja saa PIN</p>
                  </div>
                </div>
              </button>

            <button
              onClick={() => setMode('join')}
              className="w-full bg-white rounded-2xl p-6 shadow-sm border-2 border-slate-200 hover:border-emerald-400 hover:shadow-lg transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                  <UserPlus className="w-7 h-7 text-emerald-600" />
                </div>
                <div className="text-left flex-1">
                  <h3 className="text-lg font-bold text-slate-800">Liitu mänguga</h3>
                  <p className="text-sm text-slate-500">Sisesta PIN, et liituda sessiooniga</p>
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
                  <h3 className="text-lg font-bold text-slate-800">Soolotreening</h3>
                  <p className="text-sm text-slate-500">Harjuta üksi ilma hostimata</p>
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
                  <h3 className="text-lg font-bold text-slate-800">Puttingu rekordid</h3>
                  <p className="text-sm text-slate-500">Vaata edetabeleid ja parimaid tulemusi</p>
                </div>
              </div>
            </button>

            <div className="pt-8 border-t-2 border-slate-200 mt-8 space-y-3">
            <Link
              to={createPageUrl('Profile')}
              className="w-full bg-white rounded-2xl p-5 shadow-sm border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all group block"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center group-hover:bg-slate-200 transition-colors">
                  <User className="w-6 h-6 text-slate-600" />
                </div>
                <div className="text-left flex-1">
                  <h3 className="text-base font-bold text-slate-800">Minu profiil</h3>
                  <p className="text-xs text-slate-500">Statistika ja mänguajalugu</p>
                </div>
              </div>
            </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'host-setup') {
    return <HostSetup onStartGame={handleHostGame} onBack={() => setMode(null)} />;
  }

  if (mode === 'solo') {
    return <HostSetup onStartGame={async (gameData) => {
      const currentUser = auth.currentUser;
      if(!currentUser) return;
      const gameType = gameData.gameType || 'classic';
      const newGame = {
        name: gameData.name || 'Soolotreening',
        pin: '0000',
        game_type: gameType,
        putt_type: gameData.puttType || 'regular',
        host_user: currentUser.email,
        players: [currentUser.displayName],
        player_distances: { [currentUser.displayName]: GAME_FORMATS[gameType].startDistance },
        player_putts: { [currentUser.displayName]: [] },
        total_points: { [currentUser.displayName]: 0 },
        player_uids: { [currentUser.displayName]: currentUser.uid },
        player_emails: { [currentUser.displayName]: currentUser.email },
        join_closed: false,
        status: 'active',
        date: new Date().toISOString()
      };
      const docRef = await addDoc(collection(db, 'games'), newGame);
      setGameId(docRef.id);
      setPlayerName(currentUser.displayName);
      setMode('player');
    }} onBack={() => setMode(null)} isSolo={true} />;
  }

  if (mode === 'join') {
    return <JoinGame onJoin={handleJoinGame} onBack={() => setMode(null)} />;
  }

  if (mode === 'host') {
    return <HostView gameId={gameId} onExit={() => setMode(null)} />;
  }

  if (mode === 'player') {
    return <PlayerView gameId={gameId} playerName={playerName} onExit={() => setMode(null)} />;
  }

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
          const currentUser = auth.currentUser;
          if (!currentUser) return;
          const playerName = currentUser.displayName || currentUser.email || 'Player';

          const newGame = {
            name: setupData.name,
            pin: isSoloATW ? '0000' : setupData.pin,
            game_type: setupData.gameType,
            putt_type: setupData.puttType || 'regular',
            host_user: currentUser.email,
            players: isSoloATW ? [playerName] : [],
            player_distances: {},
            player_putts: {},
            total_points: {},
            player_uids: isSoloATW ? { [playerName]: currentUser.uid } : {},
            player_emails: isSoloATW ? { [playerName]: currentUser.email } : {},
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
          };

          const docRef = await addDoc(collection(db, 'games'), newGame);
          setGameId(docRef.id);
          if (isSoloATW) {
            setPlayerName(playerName);
            setMode('atw-game');
            window.history.replaceState({}, '', `${createPageUrl('Home')}?mode=atw-game&gameId=${docRef.id}`);
          } else {
            setMode('atw-host');
            window.history.replaceState({}, '', `${createPageUrl('Home')}?mode=atw-host&gameId=${docRef.id}`);
          }
        }}
      />
    );
  }

  if (mode === 'atw-host') {
    return <HostView gameId={gameId} onExit={() => setMode(null)} />;
  }

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
