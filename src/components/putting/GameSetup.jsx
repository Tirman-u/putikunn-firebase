import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, X, Play, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function GameSetup({ onStartGame }) {
  const [gameName, setGameName] = useState('');
  const [players, setPlayers] = useState(['']);

  const addPlayer = () => {
    setPlayers([...players, '']);
  };

  const removePlayer = (index) => {
    if (players.length > 1) {
      setPlayers(players.filter((_, i) => i !== index));
    }
  };

  const updatePlayer = (index, name) => {
    const newPlayers = [...players];
    newPlayers[index] = name;
    setPlayers(newPlayers);
  };

  const handleStart = () => {
    const validPlayers = players.filter(p => p.trim());
    if (validPlayers.length >= 1) {
      onStartGame({
        name: gameName || `Mäng ${new Date().toLocaleDateString('et-EE')}`,
        players: validPlayers
      });
    }
  };

  const validPlayerCount = players.filter(p => p.trim()).length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white p-4">
      <div className="max-w-lg mx-auto pt-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-emerald-200">
            <span className="text-4xl">🥏</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Puttimäng</h1>
          <p className="text-slate-500">Seadista oma puttamise treening</p>
        </div>

        {/* Game Name */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-4">
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Treeningu nimi (valikuline)
          </label>
          <Input
            value={gameName}
            onChange={(e) => setGameName(e.target.value)}
            placeholder="nt Neljapäevane treening"
            className="h-12 rounded-xl border-slate-200"
          />
        </div>

        {/* Game Rules */}
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 shadow-sm mb-4 text-white">
          <h3 className="font-bold text-lg mb-3">🥏 Jyly reeglid</h3>
          <ul className="text-sm space-y-2 opacity-95">
            <li>• Alusta 10m pealt, viska 5 ketast</li>
            <li>• Tabamuste põhjal järgmine distants: 0→5m, 1→6m, 2→7m, 3→8m, 4→9m, 5→10m</li>
            <li>• Punktid = distants × tabamused (nt 3 tabamust 8m pealt = 24 p)</li>
            <li>• Kokku 20 ringi</li>
          </ul>
        </div>

        {/* Players */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600" />
              <span className="text-sm font-semibold text-slate-700">Mängijad</span>
            </div>
            <span className="text-sm text-slate-400">{validPlayerCount} lisatud</span>
          </div>
          
          <AnimatePresence>
            <div className="space-y-3">
              {players.map((player, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex gap-2"
                >
                  <Input
                    value={player}
                    onChange={(e) => updatePlayer(index, e.target.value)}
                    placeholder={`Mängija ${index + 1}`}
                    className="h-12 rounded-xl border-slate-200"
                  />
                  {players.length > 1 && (
                    <button
                      onClick={() => removePlayer(index)}
                      className="w-12 h-12 rounded-xl bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </motion.div>
              ))}
            </div>
          </AnimatePresence>

          <Button
            onClick={addPlayer}
            variant="outline"
            className="w-full h-12 mt-4 rounded-xl border-dashed border-2"
          >
            <Plus className="w-5 h-5 mr-2" />
            Lisa mängija
          </Button>
        </div>

        {/* Start Button */}
        <Button
          onClick={handleStart}
          disabled={validPlayerCount < 1}
          className="w-full h-16 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-xl font-bold rounded-2xl shadow-xl shadow-emerald-200 disabled:opacity-50"
        >
          <Play className="w-6 h-6 mr-3" />
          Alusta mängu
        </Button>
      </div>
    </div>
  );
}
