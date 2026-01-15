import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trophy, Target, Award } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function PuttingRecords() {
  const [selectedGameType, setSelectedGameType] = useState('classic');
  const [leaderboardType, setLeaderboardType] = useState('general');
  const [selectedGender, setSelectedGender] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');

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

  // Generate last 6 months for filter
  const monthOptions = [];
  for (let i = 0; i < 6; i++) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    monthOptions.push({
      value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: format(date, 'MMMM yyyy')
    });
  }

  const filteredEntries = leaderboardEntries.filter(entry => {
    if (entry.game_type !== selectedGameType) return false;
    if (entry.leaderboard_type !== leaderboardType) return false;
    
    if (selectedGender !== 'all' && entry.player_gender !== selectedGender) return false;
    
    if (selectedMonth !== 'all' && entry.date) {
      const entryDate = new Date(entry.date);
      const [year, month] = selectedMonth.split('-');
      const monthStart = startOfMonth(new Date(parseInt(year), parseInt(month) - 1));
      const monthEnd = endOfMonth(new Date(parseInt(year), parseInt(month) - 1));
      if (entryDate < monthStart || entryDate > monthEnd) return false;
    }
    
    return true;
  });

  const sortedEntries = [...filteredEntries].sort((a, b) => b.score - a.score).slice(0, 50);

  // Helper to check if a general entry has a corresponding DG.ee entry
  const hasDiscgolfEntry = (entry) => {
    if (entry.leaderboard_type !== 'general') return false;
    return leaderboardEntries.some(e => 
      e.leaderboard_type === 'discgolf_ee' && 
      e.game_id === entry.game_id &&
      e.player_name === entry.player_name
    );
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
      <div className="flex items-center gap-3 mb-6">
        <Trophy className="w-6 h-6 text-amber-500" />
        <h2 className="text-2xl font-bold text-slate-800">Putting Records</h2>
      </div>

      <Tabs value={leaderboardType} onValueChange={setLeaderboardType} className="mb-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="discgolf_ee">Discgolf.ee</TabsTrigger>
        </TabsList>
      </Tabs>

      <Tabs value={selectedGameType} onValueChange={setSelectedGameType}>
        <div className="overflow-x-auto mb-6">
          <TabsList className="inline-flex w-auto min-w-full">
            {gameTypes.map(type => (
              <TabsTrigger key={type.id} value={type.id} className="flex-shrink-0">
                {type.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {gameTypes.map(type => (
          <TabsContent key={type.id} value={type.id}>
            <div className="space-y-4">
              <div className="flex gap-3 flex-wrap">
                <Select value={selectedGender} onValueChange={setSelectedGender}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="M">Mehed</SelectItem>
                    <SelectItem value="N">Naised</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    {monthOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                        <tr key={entry.id} className={`border-b border-slate-100 ${idx < 3 ? 'bg-amber-50' : 'hover:bg-slate-50'} cursor-pointer transition-colors`}>
                          <td className="py-3 px-2">
                            <Link to={`${createPageUrl('GameResult')}?id=${entry.game_id}`} className="block">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                                idx === 0 ? 'bg-yellow-400 text-yellow-900' :
                                idx === 1 ? 'bg-slate-300 text-slate-700' :
                                idx === 2 ? 'bg-orange-300 text-orange-800' :
                                'bg-slate-100 text-slate-600'
                              }`}>
                                {idx + 1}
                              </div>
                            </Link>
                          </td>
                          <td className="py-3 px-2 font-medium text-slate-700">
                            <Link to={`${createPageUrl('GameResult')}?id=${entry.game_id}`} className="block">
                              <div className="flex items-center gap-2">
                                <span>{entry.player_name}</span>
                                {entry.player_gender && (
                                  <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                                    {entry.player_gender}
                                  </span>
                                )}
                                {(entry.leaderboard_type === 'discgolf_ee' || hasDiscgolfEntry(entry)) && (
                                  <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded flex items-center gap-1">
                                    <Award className="w-3 h-3" />
                                    DG.ee
                                  </span>
                                )}
                              </div>
                            </Link>
                          </td>
                          <td className="py-3 px-2 text-center">
                            <Link to={`${createPageUrl('GameResult')}?id=${entry.game_id}`} className="block">
                              <span className="text-lg font-bold text-emerald-600">{entry.score}</span>
                            </Link>
                          </td>
                          <td className="py-3 px-2 text-center text-slate-700">
                            <Link to={`${createPageUrl('GameResult')}?id=${entry.game_id}`} className="block">
                              {entry.accuracy ? `${entry.accuracy.toFixed(1)}%` : '-'}
                            </Link>
                          </td>
                          <td className="py-3 px-2 text-center text-slate-600">
                            <Link to={`${createPageUrl('GameResult')}?id=${entry.game_id}`} className="block">
                              {entry.made_putts}/{entry.total_putts}
                            </Link>
                          </td>
                          <td className="py-3 px-2 text-right text-slate-500 text-xs">
                            <Link to={`${createPageUrl('GameResult')}?id=${entry.game_id}`} className="block">
                              {entry.date ? format(new Date(entry.date), 'MMM d, yyyy') : '-'}
                            </Link>
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