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

      const prompt = `Analyze this disc golf putting performance data and provide actionable insights:

Performance by format:
${JSON.stringify(performanceData, null, 2)}

Performance by distance:
${JSON.stringify(distancePerformance, null, 2)}

Provide a JSON response with:
1. strengths: array of 2-3 key strengths
2. weaknesses: array of 2-3 areas needing improvement
3. practice_routine: recommended weekly practice schedule (array of 3-4 specific drills)
4. focus_areas: specific distance ranges or formats to prioritize
5. training_drills: array of 3 personalized drills with name, description, and target metrics

Be specific with distances, percentages, and actionable advice.`;

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
      alert('Failed to generate insights. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-500" />
          AI Performance Insights
        </h3>
        <Button 
          onClick={generateInsights} 
          disabled={loading || games.length === 0}
          size="sm"
          className="bg-purple-600 hover:bg-purple-700"
        >
          {loading ? 'Analyzing...' : 'Generate Insights'}
        </Button>
      </div>

      {!insights && !loading && (
        <div className="text-center py-8 text-slate-400">
          <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Click "Generate Insights" to get AI-powered recommendations</p>
        </div>
      )}

      {insights && (
        <div className="space-y-6">
          {/* Strengths */}
          <div>
            <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              Your Strengths
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
              Focus Areas
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
              Recommended Practice Routine
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
            <h4 className="font-semibold text-slate-800 mb-3">Personalized Training Drills</h4>
            <div className="grid gap-3">
              {insights.training_drills?.map((drill, i) => (
                <div key={i} className="p-4 bg-purple-50 rounded-xl border border-purple-200">
                  <div className="font-bold text-purple-900 mb-1">{drill.name}</div>
                  <div className="text-sm text-purple-800 mb-2">{drill.description}</div>
                  <div className="text-xs text-purple-600 font-medium">Target: {drill.target}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}