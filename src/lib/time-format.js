export const formatDuration = (seconds, decimals = 1) => {
  const total = Math.max(0, Number(seconds) || 0);
  const mins = Math.floor(total / 60);
  const secs = total - mins * 60;
  const fixed = secs.toFixed(decimals);
  const padded = fixed.padStart(decimals > 0 ? 3 + decimals : 2, '0');
  return `${mins}:${padded}`;
};
