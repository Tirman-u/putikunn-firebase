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
    minDistance: 3,
    maxDistance: 15,
    startDistance: 8,
    puttsPerRound: 1,
    singlePuttMode: true,
    streakMode: true,
    manualDistance: true
  },
  random_distance: {
    name: 'Random Distance',
    minDistance: 3,
    maxDistance: 10,
    startDistance: 7,
    puttsPerRound: 5,
    randomMode: true
  }
};

export const MAX_ROUNDS = 20;

// Streak challenge has no round limit
export const STREAK_UNLIMITED = true;

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

// Calculate next distance for Streak Challenge (stays at same distance)
export function getNextDistanceStreak(currentDistance, wasMade) {
  const format = GAME_FORMATS.streak_challenge;
  // Always stay at the same distance - streak tracks consecutive makes
  return format.startDistance;
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
  
  // For other formats, scoring happens at round level, not per putt
  return 0;
}

// Calculate round score for Classic/Short/Long
export function calculateRoundScore(distance, madeCount) {
  return distance * madeCount;
}

// Check if player completed all rounds
export function isGameComplete(gameType, puttCount) {
  // Streak challenge never auto-completes
  if (gameType === 'streak_challenge') {
    return false;
  }
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