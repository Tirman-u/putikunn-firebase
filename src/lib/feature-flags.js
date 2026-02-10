const normalizeFlag = (value, defaultValue = false) => {
  if (value === undefined || value === null) return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
};

export const FEATURE_FLAGS = {
  puttingKing: normalizeFlag(import.meta.env.VITE_ENABLE_PUTTING_KING, false)
};
