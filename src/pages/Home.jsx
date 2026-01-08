import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Users, UserPlus } from 'lucide-react';

import HostSetup from '@/components/putting/HostSetup';
import JoinGame from '@/components/putting/JoinGame';
import HostView from '@/components/putting/HostView';
import PlayerView from '@/components/putting/PlayerView';

export default function Home() {
  const [mode, setMode] = useState(null); // null, 'host', 'player'
  const [gameId, setGameId] = useState(null);
  const [playerName, setPlayerName] = useState(null);

  const handleHostGame = async (gameData) => {
    const user = await base44.auth.me();
    
    const game = await base44.entities.Game.create({
      name: gameData.name,
      pin: gameData.pin,
      host_user: user.email,
      players: [],
      player_distances: {},
      round_scores: {},
      total_points: {},
      current_round: 1,
      status: 'active'
    });

    setGameId(game.id);
    setMode('host');
  };

  const handleJoinGame = ({ game, playerName }) => {
    setGameId(game.id);
    setPlayerName(playerName);
    setMode('player');
  };

  // Initial selection screen
  if (!mode) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white p-4">
        <div className="max-w-lg mx-auto pt-16">
          <div className="text-center mb-12">
            <div className="w-24 h-24 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-200">
              <span className="text-5xl">🥏</span>
            </div>
            <h1 className="text-4xl font-bold text-slate-800 mb-3">Jyly Putting Game</h1>
            <p className="text-slate-500 text-lg">Choose your role</p>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => setMode('host-setup')}
              className="w-full bg-white rounded-2xl p-8 shadow-sm border-2 border-slate-200 hover:border-emerald-400 hover:shadow-lg transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                  <Users className="w-8 h-8 text-emerald-600" />
                </div>
                <div className="text-left flex-1">
                  <h3 className="text-xl font-bold text-slate-800 mb-1">Host Game</h3>
                  <p className="text-sm text-slate-500">Create a session and get a PIN</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setMode('join')}
              className="w-full bg-white rounded-2xl p-8 shadow-sm border-2 border-slate-200 hover:border-emerald-400 hover:shadow-lg transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                  <UserPlus className="w-8 h-8 text-emerald-600" />
                </div>
                <div className="text-left flex-1">
                  <h3 className="text-xl font-bold text-slate-800 mb-1">Join Game</h3>
                  <p className="text-sm text-slate-500">Enter a PIN to join a session</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Host setup
  if (mode === 'host-setup') {
    return <HostSetup onStartGame={handleHostGame} />;
  }

  // Join game
  if (mode === 'join') {
    return <JoinGame onJoin={handleJoinGame} />;
  }

  // Host view
  if (mode === 'host') {
    return <HostView gameId={gameId} onExit={() => setMode(null)} />;
  }

  // Player view
  if (mode === 'player') {
    return <PlayerView gameId={gameId} playerName={playerName} onExit={() => setMode(null)} />;
  }

  return null;
}