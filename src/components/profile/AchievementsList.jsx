import React from 'react';
import { Lock } from 'lucide-react';

export function getAchievements(stats, isAdmin = false) {
  const { totalGames, puttingPercentage, bestScore, avgScore, allPutts, myGames, myName } = stats;

  const achievements = [
    // Beginner Achievements
    { 
      id: 'first_game', 
      name: 'Esimesed sammud', 
      description: 'Lõpeta oma esimene mäng',
      unlocked: totalGames > 0,
      icon: '🎯',
      tier: 'bronze'
    },
    { 
      id: 'five_games', 
      name: 'Algus tehtud', 
      description: 'Mängi 5 mängu',
      unlocked: totalGames >= 5,
      icon: '🎮',
      tier: 'bronze'
    },
    { 
      id: 'ten_games', 
      name: 'Püsiv mängija', 
      description: 'Mängi 10 mängu',
      unlocked: totalGames >= 10,
      icon: '🔥',
      tier: 'silver'
    },
    { 
      id: 'veteran', 
      name: 'Veteran', 
      description: 'Mängi 25 mängu',
      unlocked: totalGames >= 25,
      icon: '⭐',
      tier: 'gold'
    },
    { 
      id: 'legend', 
      name: 'Legend', 
      description: 'Mängi 50 mängu',
      unlocked: totalGames >= 50,
      icon: '👑',
      tier: 'platinum'
    },

    // Accuracy Achievements
    { 
      id: 'decent_shot', 
      name: 'Hea tabamus', 
      description: 'Saavuta 60%+ täpsus',
      unlocked: parseFloat(puttingPercentage) >= 60,
      icon: '🎪',
      tier: 'bronze'
    },
    { 
      id: 'sharp_eye', 
      name: 'Terav silm', 
      description: 'Saavuta 70%+ täpsus',
      unlocked: parseFloat(puttingPercentage) >= 70,
      icon: '👁️',
      tier: 'silver'
    },
    { 
      id: 'marksman', 
      name: 'Täpsuskütt', 
      description: 'Saavuta 80%+ täpsus',
      unlocked: parseFloat(puttingPercentage) >= 80,
      icon: '🏹',
      tier: 'gold'
    },
    { 
      id: 'sharpshooter', 
      name: 'Meisterlaskur', 
      description: 'Saavuta 90%+ täpsus',
      unlocked: parseFloat(puttingPercentage) >= 90,
      icon: '🎖️',
      tier: 'platinum'
    },
    { 
      id: 'perfect_aim', 
      name: 'Täiuslik siht', 
      description: 'Saavuta 95%+ täpsus',
      unlocked: parseFloat(puttingPercentage) >= 95,
      icon: '💎',
      tier: 'diamond'
    },

    // Scoring Achievements
    { 
      id: 'century', 
      name: '300 klubi', 
      description: 'Saavuta mängus 300+ punkti',
      unlocked: bestScore >= 300,
      icon: '💯',
      tier: 'bronze'
    },
    { 
      id: 'high_scorer', 
      name: 'Kõrge tulemus', 
      description: 'Saavuta mängus 500+ punkti',
      unlocked: bestScore >= 500,
      icon: '🏆',
      tier: 'silver'
    },
    { 
      id: 'point_machine', 
      name: 'Punktimasin', 
      description: 'Saavuta mängus 600+ punkti',
      unlocked: bestScore >= 600,
      icon: '🔴',
      tier: 'gold'
    },
    { 
      id: 'unstoppable', 
      name: 'Peatumatu', 
      description: 'Saavuta mängus 700+ punkti',
      unlocked: bestScore >= 700,
      icon: '🚀',
      tier: 'platinum'
    },

    // Consistency Achievements
    { 
      id: 'consistent', 
      name: 'Stabiilne', 
      description: 'Keskmiselt 350+ punkti mängus',
      unlocked: avgScore >= 350,
      icon: '📊',
      tier: 'silver'
    },
    { 
      id: 'reliable', 
      name: 'Usaldusväärne', 
      description: 'Keskmiselt 450+ punkti mängus',
      unlocked: avgScore >= 450,
      icon: '⚖️',
      tier: 'gold'
    },

    // Special Achievements - Perfect Rounds
    { 
      id: 'perfect_round_5', 
      name: 'Täiuslik ring', 
      description: 'Sees 5 järjestikust putti',
      unlocked: checkStreak(allPutts, 5),
      icon: '⭐',
      tier: 'bronze'
    },
    { 
      id: 'perfect_round_10', 
      name: 'Täiuslik seeria x2', 
      description: 'Sees 10 järjestikust putti',
      unlocked: checkStreak(allPutts, 10),
      icon: '⭐⭐',
      tier: 'silver'
    },
    { 
      id: 'perfect_round_15', 
      name: 'Täiuslik seeria x3', 
      description: 'Sees 15 järjestikust putti',
      unlocked: checkStreak(allPutts, 15),
      icon: '⭐⭐⭐',
      tier: 'gold'
    },
    { 
      id: 'perfect_round_20', 
      name: 'Seeriameister', 
      description: 'Sees 20 järjestikust putti',
      unlocked: checkStreak(allPutts, 20),
      icon: '✨',
      tier: 'platinum'
    },
    { 
      id: 'long_distance', 
      name: 'Pikk distants', 
      description: 'Sees 12m+ putt',
      unlocked: allPutts?.some(p => p.distance >= 12 && p.result === 'made'),
      icon: '🎯',
      tier: 'silver'
    },
    { 
      id: 'ultra_distance', 
      name: 'Ülipikk distants', 
      description: 'Sees 15m putt',
      unlocked: allPutts?.some(p => p.distance >= 15 && p.result === 'made'),
      icon: '🌟',
      tier: 'platinum'
    },
    { 
      id: 'five_hundred_makes', 
      name: '500 klubi', 
      description: 'Sees kokku 500 putti',
      unlocked: allPutts?.filter(p => p.result === 'made').length >= 500,
      icon: '🎊',
      tier: 'silver'
    },
    { 
      id: 'thousand_makes', 
      name: '1000 eliit', 
      description: 'Sees kokku 1000 putti',
      unlocked: allPutts?.filter(p => p.result === 'made').length >= 1000,
      icon: '🏅',
      tier: 'gold'
    },

    // Format Mastery
    { 
      id: 'format_explorer', 
      name: 'Formaatide avastaja', 
      description: 'Proovi 3 erinevat formaati',
      unlocked: new Set(myGames?.map(g => g.game_type)).size >= 3,
      icon: '🗺️',
      tier: 'bronze'
    },
    { 
      id: 'all_formats', 
      name: 'Mitme ala meister', 
      description: 'Mängi kõiki formaate',
      unlocked: new Set(myGames?.map(g => g.game_type)).size >= 7,
      icon: '🃏',
      tier: 'platinum'
    },

    // Streak Achievements
    { 
      id: 'ten_streak', 
      name: 'Kuum seeria', 
      description: 'Sees 10 järjestikust putti',
      unlocked: checkStreak(allPutts, 10),
      icon: '🔥',
      tier: 'bronze'
    },
    { 
      id: 'twenty_streak', 
      name: 'Peatumatu seeria', 
      description: 'Sees 20 järjestikust putti',
      unlocked: checkStreak(allPutts, 20),
      icon: '💥',
      tier: 'silver'
    },
    { 
      id: 'thirty_streak', 
      name: 'Legendaarne seeria', 
      description: 'Sees 30 järjestikust putti',
      unlocked: checkStreak(allPutts, 30),
      icon: '⚡',
      tier: 'gold'
    },
    { 
      id: 'fifty_streak', 
      name: 'Jumalalik seeria', 
      description: 'Sees 50 järjestikust putti',
      unlocked: checkStreak(allPutts, 50),
      icon: '👑',
      tier: 'platinum'
    },

    // Practice Achievements
    { 
      id: 'early_bird', 
      name: 'Varajane ärkaja', 
      description: 'Mängi mäng enne kella 9',
      unlocked: myGames?.some(g => new Date(g.date).getHours() < 9),
      icon: '🌅',
      tier: 'bronze'
    },
    { 
      id: 'night_owl', 
      name: 'Öökull', 
      description: 'Mängi mäng pärast kella 21',
      unlocked: myGames?.some(g => new Date(g.date).getHours() >= 21),
      icon: '🦉',
      tier: 'bronze'
    },
    { 
      id: 'weekend_warrior', 
      name: 'Nädalavahetuse sõdur', 
      description: 'Mängi nädalavahetustel 10 mängu',
      unlocked: myGames?.filter(g => {
        const day = new Date(g.date).getDay();
        return day === 0 || day === 6;
      }).length >= 10,
      icon: '⚔️',
      tier: 'silver'
    },
    { 
      id: 'daily_grinder', 
      name: 'Igapäevane tegija', 
      description: 'Mängi 7 päeva järjest',
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
