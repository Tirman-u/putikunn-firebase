import React from 'react';
import { Lock } from 'lucide-react';

export function getAchievements(stats, isAdmin = false) {
  const { totalGames, puttingPercentage, bestScore, avgScore, allPutts, myGames, myName } = stats;

  const achievements = [
    // Beginner Achievements
    { 
      id: 'first_game', 
      name: 'First Steps', 
      description: 'Complete your first game',
      unlocked: totalGames > 0,
      icon: '🎯',
      tier: 'bronze'
    },
    { 
      id: 'five_games', 
      name: 'Getting Started', 
      description: 'Play 5 games',
      unlocked: totalGames >= 5,
      icon: '🎮',
      tier: 'bronze'
    },
    { 
      id: 'ten_games', 
      name: 'Regular Player', 
      description: 'Play 10 games',
      unlocked: totalGames >= 10,
      icon: '🔥',
      tier: 'silver'
    },
    { 
      id: 'veteran', 
      name: 'Veteran', 
      description: 'Play 25 games',
      unlocked: totalGames >= 25,
      icon: '⭐',
      tier: 'gold'
    },
    { 
      id: 'legend', 
      name: 'Legend', 
      description: 'Play 50 games',
      unlocked: totalGames >= 50,
      icon: '👑',
      tier: 'platinum'
    },

    // Accuracy Achievements
    { 
      id: 'decent_shot', 
      name: 'Decent Shot', 
      description: 'Achieve 60%+ accuracy',
      unlocked: parseFloat(puttingPercentage) >= 60,
      icon: '🎪',
      tier: 'bronze'
    },
    { 
      id: 'sharp_eye', 
      name: 'Sharp Eye', 
      description: 'Achieve 70%+ accuracy',
      unlocked: parseFloat(puttingPercentage) >= 70,
      icon: '👁️',
      tier: 'silver'
    },
    { 
      id: 'marksman', 
      name: 'Marksman', 
      description: 'Achieve 80%+ accuracy',
      unlocked: parseFloat(puttingPercentage) >= 80,
      icon: '🏹',
      tier: 'gold'
    },
    { 
      id: 'sharpshooter', 
      name: 'Sharpshooter', 
      description: 'Achieve 90%+ accuracy',
      unlocked: parseFloat(puttingPercentage) >= 90,
      icon: '🎖️',
      tier: 'platinum'
    },
    { 
      id: 'perfect_aim', 
      name: 'Perfect Aim', 
      description: 'Achieve 95%+ accuracy',
      unlocked: parseFloat(puttingPercentage) >= 95,
      icon: '💎',
      tier: 'diamond'
    },

    // Scoring Achievements
    { 
      id: 'century', 
      name: 'Century', 
      description: 'Score 300+ points in a game',
      unlocked: bestScore >= 300,
      icon: '💯',
      tier: 'bronze'
    },
    { 
      id: 'high_scorer', 
      name: 'High Scorer', 
      description: 'Score 500+ points in a game',
      unlocked: bestScore >= 500,
      icon: '🏆',
      tier: 'silver'
    },
    { 
      id: 'point_machine', 
      name: 'Point Machine', 
      description: 'Score 600+ points in a game',
      unlocked: bestScore >= 600,
      icon: '🔴',
      tier: 'gold'
    },
    { 
      id: 'unstoppable', 
      name: 'Unstoppable', 
      description: 'Score 700+ points in a game',
      unlocked: bestScore >= 700,
      icon: '🚀',
      tier: 'platinum'
    },

    // Consistency Achievements
    { 
      id: 'consistent', 
      name: 'Consistent', 
      description: 'Average 350+ points per game',
      unlocked: avgScore >= 350,
      icon: '📊',
      tier: 'silver'
    },
    { 
      id: 'reliable', 
      name: 'Reliable', 
      description: 'Average 450+ points per game',
      unlocked: avgScore >= 450,
      icon: '⚖️',
      tier: 'gold'
    },

    // Special Achievements - Perfect Rounds
    { 
      id: 'perfect_round_5', 
      name: 'Perfect Round', 
      description: 'Make 5 consecutive putts',
      unlocked: checkStreak(allPutts, 5),
      icon: '⭐',
      tier: 'bronze'
    },
    { 
      id: 'perfect_round_10', 
      name: 'Perfect Streak x2', 
      description: 'Make 10 consecutive putts',
      unlocked: checkStreak(allPutts, 10),
      icon: '⭐⭐',
      tier: 'silver'
    },
    { 
      id: 'perfect_round_15', 
      name: 'Perfect Streak x3', 
      description: 'Make 15 consecutive putts',
      unlocked: checkStreak(allPutts, 15),
      icon: '⭐⭐⭐',
      tier: 'gold'
    },
    { 
      id: 'perfect_round_20', 
      name: 'Perfect Streak Master', 
      description: 'Make 20 consecutive putts',
      unlocked: checkStreak(allPutts, 20),
      icon: '✨',
      tier: 'platinum'
    },
    { 
      id: 'long_distance', 
      name: 'Long Distance', 
      description: 'Make a 12m+ putt',
      unlocked: allPutts?.some(p => p.distance >= 12 && p.result === 'made'),
      icon: '🎯',
      tier: 'silver'
    },
    { 
      id: 'ultra_distance', 
      name: 'Ultra Distance', 
      description: 'Make a 15m putt',
      unlocked: allPutts?.some(p => p.distance >= 15 && p.result === 'made'),
      icon: '🌟',
      tier: 'platinum'
    },
    { 
      id: 'five_hundred_makes', 
      name: 'Century Club', 
      description: 'Make 500 putts total',
      unlocked: allPutts?.filter(p => p.result === 'made').length >= 500,
      icon: '🎊',
      tier: 'silver'
    },
    { 
      id: 'thousand_makes', 
      name: 'Elite 1000', 
      description: 'Make 1000 putts total',
      unlocked: allPutts?.filter(p => p.result === 'made').length >= 1000,
      icon: '🏅',
      tier: 'gold'
    },

    // Format Mastery
    { 
      id: 'format_explorer', 
      name: 'Format Explorer', 
      description: 'Try 3 different formats',
      unlocked: new Set(myGames?.map(g => g.game_type)).size >= 3,
      icon: '🗺️',
      tier: 'bronze'
    },
    { 
      id: 'all_formats', 
      name: 'Jack of All Trades', 
      description: 'Play all game formats',
      unlocked: new Set(myGames?.map(g => g.game_type)).size >= 7,
      icon: '🃏',
      tier: 'platinum'
    },

    // Streak Achievements
    { 
      id: 'ten_streak', 
      name: 'Hot Streak', 
      description: 'Make 10 consecutive putts',
      unlocked: checkStreak(allPutts, 10),
      icon: '🔥',
      tier: 'bronze'
    },
    { 
      id: 'twenty_streak', 
      name: 'Unstoppable Streak', 
      description: 'Make 20 consecutive putts',
      unlocked: checkStreak(allPutts, 20),
      icon: '💥',
      tier: 'silver'
    },
    { 
      id: 'thirty_streak', 
      name: 'Legendary Streak', 
      description: 'Make 30 consecutive putts',
      unlocked: checkStreak(allPutts, 30),
      icon: '⚡',
      tier: 'gold'
    },
    { 
      id: 'fifty_streak', 
      name: 'Godlike Streak', 
      description: 'Make 50 consecutive putts',
      unlocked: checkStreak(allPutts, 50),
      icon: '👑',
      tier: 'platinum'
    },

    // Practice Achievements
    { 
      id: 'early_bird', 
      name: 'Early Bird', 
      description: 'Play a game before 9am',
      unlocked: myGames?.some(g => new Date(g.date).getHours() < 9),
      icon: '🌅',
      tier: 'bronze'
    },
    { 
      id: 'night_owl', 
      name: 'Night Owl', 
      description: 'Play a game after 9pm',
      unlocked: myGames?.some(g => new Date(g.date).getHours() >= 21),
      icon: '🦉',
      tier: 'bronze'
    },
    { 
      id: 'weekend_warrior', 
      name: 'Weekend Warrior', 
      description: 'Play 10 games on weekends',
      unlocked: myGames?.filter(g => {
        const day = new Date(g.date).getDay();
        return day === 0 || day === 6;
      }).length >= 10,
      icon: '⚔️',
      tier: 'silver'
    },
    { 
      id: 'daily_grinder', 
      name: 'Daily Grinder', 
      description: 'Play on 7 consecutive days',
      unlocked: checkConsecutiveDays(myGames, 7),
      icon: '📅',
      tier: 'gold'
    }
  ];

  // Return all for admin, only unlocked for regular users
  return isAdmin ? achievements : achievements.filter(a => a.unlocked);
}

function checkStreak(putts, targetLength) {
  if (!putts || putts.length < targetLength) return false;
  
  let currentStreak = 0;
  let maxStreak = 0;
  
  putts.forEach(putt => {
    if (putt.result === 'made') {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  });
  
  return maxStreak >= targetLength;
}

function checkConsecutiveDays(games, targetDays) {
  if (!games || games.length < targetDays) return false;
  
  const dates = games
    .map(g => new Date(g.date).toDateString())
    .sort();
  
  let consecutiveDays = 1;
  let maxConsecutive = 1;
  
  for (let i = 1; i < dates.length; i++) {
    const prevDate = new Date(dates[i - 1]);
    const currDate = new Date(dates[i]);
    const dayDiff = Math.floor((currDate - prevDate) / (1000 * 60 * 60 * 24));
    
    if (dayDiff === 1) {
      consecutiveDays++;
      maxConsecutive = Math.max(maxConsecutive, consecutiveDays);
    } else if (dayDiff > 1) {
      consecutiveDays = 1;
    }
  }
  
  return maxConsecutive >= targetDays;
}

export default function AchievementsList({ achievements }) {
  const tierColors = {
    bronze: 'border-amber-700 bg-amber-50',
    silver: 'border-slate-400 bg-slate-50',
    gold: 'border-yellow-500 bg-yellow-50',
    platinum: 'border-cyan-400 bg-cyan-50',
    diamond: 'border-purple-500 bg-purple-50'
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {achievements.map(achievement => (
        <div 
          key={achievement.id}
          className={`p-4 rounded-xl border-2 ${
            achievement.unlocked 
              ? tierColors[achievement.tier] 
              : 'bg-slate-50 border-slate-200 opacity-60'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="text-3xl">
              {achievement.unlocked ? achievement.icon : <Lock className="w-7 h-7 text-slate-400" />}
            </div>
            <div>
              <div className="font-bold text-slate-800">
                {achievement.name}
              </div>
              <div className="text-sm text-slate-600">
                {achievement.description}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}