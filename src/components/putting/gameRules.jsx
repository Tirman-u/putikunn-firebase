// Game format configurations
export const GAME_FORMATS = {
  classic: {
    name: 'Classic',
    minDistance: 5,
    maxDistance: 10,
    startDistance: 10,
    puttsPerRound: 5,
    distanceMap: [5, 6, 7, 8, 9, 10]
  },
  short: {
    name: 'Short',
    minDistance: 3,
    maxDistance: 8,
    startDistance: 8,
    puttsPerRound: 5,
    distanceMap: [3, 4, 5, 6, 7, 8]
  },
  long: {
    name: 'Long',
    minDistance: 10,
    maxDistance: 15,
    startDistance: 15,
    puttsPerRound: 5,
    distanceMap: [10, 11, 12, 13, 14, 15]
  },
  back_and_forth: {
    name: 'Back & Forth',
    minDistance: 5,
    maxDistance: 10,
    startDistance: 5,
    puttsPerRound: 5,
    singlePuttMode: true
  },
  streak_challenge: {
    name: 'Streak Challenge',
    minDistance: 5,
    maxDistance: 10,
    startDistance: 7,
    puttsPerRound: 1,
    singlePuttMode: true,
    streakMode: true
  },
  pressure_test: {
    name: 'Pressure Test',
    minDistance: 5,
    maxDistance: 10,
    startDistance: 8,
    puttsPerRound: 3,
    distanceMap: [8, 8, 8, 8, 8, 8],
    pressureMode: true
  },
  random_distance: {
    name: 'Random Distance',
    minDistance: 3,
    maxDistance: 15,
    startDistance: 7,
    puttsPerRound: 5,
    randomMode: true
  },
  elimination: {
    name: 'Elimination',
    minDistance: 5,
    maxDistance: 12,
    startDistance: 5,
    puttsPerRound: 3,
    eliminationMode: true
  }
};

export const MAX_ROUNDS = 20;

// Calculate next distance for Classic/Short/Long formats
export function getNextDistanceFromMade(gameType, madeCount) {
  const format = GAME_FORMATS[gameType];
  if (!format || !format.distanceMap) return format.startDistance;
  
  return format.distanceMap[madeCount] || format.maxDistance;
}

// Calculate next distance for Back & Forth format
export function getNextDistanceBackAndForth(currentDistance, wasMade) {
  const format = GAME_FORMATS.back_and_forth;
  let newDistance = wasMade ? currentDistance + 1 : currentDistance - 1;
  return Math.max(format.minDistance, Math.min(format.maxDistance, newDistance));
}

// Calculate next distance for Streak Challenge
export function getNextDistanceStreak(currentDistance, wasMade, currentStreak) {
  const format = GAME_FORMATS.streak_challenge;
  if (!wasMade) return format.startDistance;
  
  // Every 3 makes, increase distance by 1m
  if (currentStreak % 3 === 0) {
    return Math.min(currentDistance + 1, format.maxDistance);
  }
  return currentDistance;
}

// Calculate next distance for Elimination mode
export function getNextDistanceElimination(currentDistance, madePutts, totalAttempts) {
  const format = GAME_FORMATS.elimination;
  // If you make 2 or more out of 3, advance to next distance
  if (madePutts >= 2) {
    return Math.min(currentDistance + 1, format.maxDistance);
  }
  // Otherwise stay at same distance
  return currentDistance;
}

// Get random distance for Random Distance mode
export function getRandomDistance() {
  const format = GAME_FORMATS.random_distance;
  return Math.floor(Math.random() * (format.maxDistance - format.minDistance + 1)) + format.minDistance;
}

// Calculate points for a putt
export function calculatePoints(gameType, distance, result) {
  if (result === 'missed') return 0;
  
  // For Back & Forth and Streak Challenge, each made putt scores the distance
  if (gameType === 'back_and_forth' || gameType === 'streak_challenge') {
    return distance;
  }
  
  // For Pressure Test, bonus points for making all 3 in a row
  if (gameType === 'pressure_test') {
    return 0; // Calculated at round level
  }
  
  // For other formats, scoring happens at round level, not per putt
  return 0;
}

// Calculate round score for Classic/Short/Long
export function calculateRoundScore(distance, madeCount) {
  return distance * madeCount;
}

// Check if player completed all rounds
export function isGameComplete(gameType, puttCount) {
  const format = GAME_FORMATS[gameType];
  const totalPutts = MAX_ROUNDS * format.puttsPerRound;
  return puttCount >= totalPutts;
}

// Get current round number
export function getCurrentRound(puttCount, puttsPerRound) {
  return Math.floor(puttCount / puttsPerRound) + 1;
}

// Get putts in current round
export function getPuttsInCurrentRound(puttCount, puttsPerRound) {
  return puttCount % puttsPerRound;
}