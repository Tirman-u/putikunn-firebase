import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trophy, Target } from 'lucide-react';
import { format } from 'date-fns';

export default function PuttingRecords() {
  const [selectedGameType, setSelectedGameType] = useState('classic');
  const [selectedFilter, setSelectedFilter] = useState('general');
  const [selectedGender, setSelectedGender] = useState('all');

  const { data: leaderboardEntries = [] } = useQuery({
    queryKey: ['leaderboard-entries'],
    queryFn: () => base44.entities.LeaderboardEntry.list(),
    refetchInterval: 10000
  });

  const gameTypes = [
    { id: 'classic', label: 'Classic' },
    { id: 'back_and_forth', label: 'Back & Forth' },
    { id: 'short', label: 'Short' },
    { id: 'streak_challenge', label: 'Streak' },
    { id: 'random_distance', label: 'Random' }
  ];

  const filteredEntries = leaderboardEntries.filter(entry => {
    if (entry.game_type !== selectedGameType) return false;
    
    if (selectedFilter === 'discgolf_ee') {
      if (entry.leaderboard_type !== 'discgolf_ee') return false;
      if (selectedGender !== 'all' && entry.player_gender !== selectedGender) return false;
    } else {
      if (entry.leaderboard_type !== 'general') return false;
      if (selectedFilter === 'mehed' && entry.player_gender !== 'M') return false;
      if (selectedFilter === 'naised' && entry.player_gender !== 'N') return false;
    }
    
    return true;
  });

  const sortedEntries = [...filteredEntries].sort((a, b) => b.score - a.score).slice(0, 50);

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
      <div className="flex items-center gap-3 mb-6">
        <Trophy className="w-6 h-6 text-amber-500" />
        <h2 className="text-2xl font-bold text-slate-800">Putting Records</h2>
      </div>

      <Tabs value={selectedGameType} onValueChange={setSelectedGameType}>
        <TabsList className="grid w-full grid-cols-5 mb-6">
          {gameTypes.map(type => (
            <TabsTrigger key={type.id} value={type.id}>
              {type.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {gameTypes.map(type => (
          <TabsContent key={type.id} value={type.id}>
            <div className="space-y-4">
              <div className="flex gap-3">
                <Select value={selectedFilter} onValueChange={(val) => {
                  setSelectedFilter(val);
                  if (val !== 'discgolf_ee') setSelectedGender('all');
                }}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="mehed">Mehed</SelectItem>
                    <SelectItem value="naised">Naised</SelectItem>
                    <SelectItem value="discgolf_ee">Discgolf.ee</SelectItem>
                  </SelectContent>
                </Select>

                {selectedFilter === 'discgolf_ee' && (
                  <Select value={selectedGender} onValueChange={setSelectedGender}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="M">Mehed</SelectItem>
                      <SelectItem value="N">Naised</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              {sortedEntries.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No records yet. Be the first!</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-slate-200">
                        <th className="text-left py-3 px-2 text-slate-600 font-semibold">#</th>
                        <th className="text-left py-3 px-2 text-slate-600 font-semibold">Player</th>
                        <th className="text-center py-3 px-2 text-slate-600 font-semibold">Score</th>
                        <th className="text-center py-3 px-2 text-slate-600 font-semibold">Accuracy</th>
                        <th className="text-center py-3 px-2 text-slate-600 font-semibold">Putts</th>
                        <th className="text-right py-3 px-2 text-slate-600 font-semibold">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedEntries.map((entry, idx) => (
                        <tr key={entry.id} className={`border-b border-slate-100 ${idx < 3 ? 'bg-amber-50' : 'hover:bg-slate-50'}`}>
                          <td className="py-3 px-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                              idx === 0 ? 'bg-yellow-400 text-yellow-900' :
                              idx === 1 ? 'bg-slate-300 text-slate-700' :
                              idx === 2 ? 'bg-orange-300 text-orange-800' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {idx + 1}
                            </div>
                          </td>
                          <td className="py-3 px-2 font-medium text-slate-700">
                            {entry.player_name}
                            {entry.player_gender && (
                              <span className="ml-2 text-xs px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                                {entry.player_gender}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-center">
                            <span className="text-lg font-bold text-emerald-600">{entry.score}</span>
                          </td>
                          <td className="py-3 px-2 text-center text-slate-700">
                            {entry.accuracy ? `${entry.accuracy.toFixed(1)}%` : '-'}
                          </td>
                          <td className="py-3 px-2 text-center text-slate-600">
                            {entry.made_putts}/{entry.total_putts}
                          </td>
                          <td className="py-3 px-2 text-right text-slate-500 text-xs">
                            {entry.date ? format(new Date(entry.date), 'MMM d, yyyy') : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}