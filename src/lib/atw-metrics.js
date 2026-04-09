export function calculateATWBestMetrics(playerState = {}, totalScore = 0, overrides = {}) {
  const totalMakes = Number(overrides.totalMakes ?? playerState.total_makes ?? 0);
  const totalPutts = Number(overrides.totalPutts ?? playerState.total_putts ?? 0);
  const lapsCompleted = Number(overrides.lapsCompleted ?? playerState.laps_completed ?? 0);
  const bestScore = Number(playerState.best_score ?? 0);
  const bestLaps = Number(playerState.best_laps ?? 0);
  const bestAccuracy = Number(playerState.best_accuracy ?? 0);
  const safeTotalScore = Number(totalScore ?? 0);
  const currentAccuracy = totalPutts > 0 ? (totalMakes / totalPutts) * 100 : 0;

  return {
    bestScore: Math.max(bestScore, safeTotalScore),
    bestLaps: Math.max(bestLaps, lapsCompleted),
    bestAccuracy: Math.max(bestAccuracy, currentAccuracy)
  };
}

export function resolveATWDisplayBestScore(playerState = {}, currentScore = 0) {
  return Math.max(Number(playerState?.best_score ?? 0), Number(currentScore ?? 0));
}

export function resolveATWDisplayAttemptCount(playerState = {}, currentScore = 0) {
  const attemptsCount = Number(playerState?.attempts_count ?? 0);
  const historyLength = Array.isArray(playerState?.history) ? playerState.history.length : 0;
  const hasStartedAttempt =
    attemptsCount > 0 ||
    historyLength > 0 ||
    Number(playerState?.turns_played ?? 0) > 0 ||
    Number(playerState?.total_putts ?? 0) > 0 ||
    Number(playerState?.total_makes ?? 0) > 0 ||
    Number(playerState?.laps_completed ?? 0) > 0 ||
    Number(playerState?.best_score ?? 0) > 0 ||
    Number(currentScore ?? 0) > 0;

  return hasStartedAttempt ? attemptsCount + 1 : 0;
}

export function isATWStateAhead(localState = {}, localPoints = 0, remoteState = {}, remotePoints = 0) {
  const localHistoryLength = Array.isArray(localState?.history) ? localState.history.length : 0;
  const remoteHistoryLength = Array.isArray(remoteState?.history) ? remoteState.history.length : 0;
  const localBestScore = resolveATWDisplayBestScore(localState, localPoints);
  const remoteBestScore = resolveATWDisplayBestScore(remoteState, remotePoints);

  if (localBestScore > remoteBestScore) return true;
  if (Number(localPoints ?? 0) > Number(remotePoints ?? 0)) return true;
  if (localHistoryLength > remoteHistoryLength) return true;
  if (Number(localState?.turns_played ?? 0) > Number(remoteState?.turns_played ?? 0)) return true;
  if (Number(localState?.total_putts ?? 0) > Number(remoteState?.total_putts ?? 0)) return true;
  if (Number(localState?.total_makes ?? 0) > Number(remoteState?.total_makes ?? 0)) return true;
  if (Number(localState?.laps_completed ?? 0) > Number(remoteState?.laps_completed ?? 0)) return true;
  if (Number(localState?.attempts_count ?? 0) > Number(remoteState?.attempts_count ?? 0)) return true;

  return false;
}
