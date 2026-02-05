import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Sparkles, TrendingUp, Target, Lightbulb } from 'lucide-react';

export default function AIInsights({ games, userName }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);

  const generateInsights = async () => {
    setLoading(true);
    try {
      // Prepare performance data
      const performanceData = games.map(game => {
        const putts = game.player_putts?.[userName] || [];
        const made = putts.filter(p => p.result === 'made').length;
        const percentage = putts.length > 0 ? (made / putts.length * 100).toFixed(1) : 0;
        
        return {
          format: game.game_type,
          score: game.total_points?.[userName] || 0,
          accuracy: percentage,
          putts: putts.length,
          date: game.date
        };
      });

      // Distance-specific performance
      const allPutts = games.flatMap(g => g.player_putts?.[userName] || []);
      const distanceStats = allPutts.reduce((acc, putt) => {
        const dist = putt.distance;
        if (!acc[dist]) acc[dist] = { made: 0, attempts: 0 };
        if (putt.result === 'made') acc[dist].made += 1;
        acc[dist].attempts += 1;
        return acc;
      }, {});

      const distancePerformance = Object.entries(distanceStats).map(([dist, stats]) => ({
        distance: dist,
        percentage: ((stats.made / stats.attempts) * 100).toFixed(1),
        attempts: stats.attempts
      }));

      const prompt = `Analüüsi neid discgolfi puttimise andmeid ja anna praktilised soovitused eesti keeles.

Tulemused formaadi lõikes:
${JSON.stringify(performanceData, null, 2)}

Tulemused distantsi lõikes:
${JSON.stringify(distancePerformance, null, 2)}

Tagasta JSON vastus järgmiste võtmetega:
1. strengths: 2-3 tugevust
2. weaknesses: 2-3 parendusvaldkonda
3. practice_routine: soovituslik nädalane treeningkava (3-4 konkreetset harjutust)
4. focus_areas: distantsid või formaadid, millele keskenduda
5. training_drills: 3 isikupärastatud harjutust (name, description, target)

Ole konkreetne distantside, protsentide ja tegevussoovitustega.`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            strengths: { type: "array", items: { type: "string" } },
            weaknesses: { type: "array", items: { type: "string" } },
            practice_routine: { type: "array", items: { type: "string" } },
            focus_areas: { type: "array", items: { type: "string" } },
            training_drills: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  target: { type: "string" }
                }
              }
            }
          }
        }
      });

      setInsights(result);
    } catch (error) {
      console.error('Failed to generate insights:', error);
      alert('Soovituste loomine ebaõnnestus. Palun proovi uuesti.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-500" />
          AI sooritusanalüüs
        </h3>
        <Button 
          onClick={generateInsights} 
          disabled={loading || games.length === 0}
          size="sm"
          className="bg-purple-600 hover:bg-purple-700"
        >
          {loading ? 'Analüüsib...' : 'Loo soovitused'}
        </Button>
      </div>

      {!insights && !loading && (
        <div className="text-center py-8 text-slate-400">
          <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Vajuta “Loo soovitused”, et saada AI soovitused</p>
        </div>
      )}

      {insights && (
        <div className="space-y-6">
          {/* Strengths */}
          <div>
            <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              Tugevused
            </h4>
            <div className="space-y-2">
              {insights.strengths?.map((strength, i) => (
                <div key={i} className="p-3 bg-green-50 rounded-lg text-sm text-green-800">
                  {strength}
                </div>
              ))}
            </div>
          </div>

          {/* Areas for Improvement */}
          <div>
            <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
              <Target className="w-4 h-4 text-amber-600" />
              Fookusvaldkonnad
            </h4>
            <div className="space-y-2">
              {insights.weaknesses?.map((weakness, i) => (
                <div key={i} className="p-3 bg-amber-50 rounded-lg text-sm text-amber-800">
                  {weakness}
                </div>
              ))}
            </div>
          </div>

          {/* Practice Routine */}
          <div>
            <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-blue-600" />
              Soovitatud treeningkava
            </h4>
            <div className="space-y-2">
              {insights.practice_routine?.map((routine, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-blue-600">{i + 1}</span>
                  </div>
                  <p className="text-sm text-slate-700">{routine}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Training Drills */}
          <div>
            <h4 className="font-semibold text-slate-800 mb-3">Isikupärastatud harjutused</h4>
            <div className="grid gap-3">
              {insights.training_drills?.map((drill, i) => (
                <div key={i} className="p-4 bg-purple-50 rounded-xl border border-purple-200">
                  <div className="font-bold text-purple-900 mb-1">{drill.name}</div>
                  <div className="text-sm text-purple-800 mb-2">{drill.description}</div>
                  <div className="text-xs text-purple-600 font-medium">Eesmärk: {drill.target}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
