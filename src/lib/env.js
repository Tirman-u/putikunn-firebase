export const getHostname = () => {
  if (typeof window === 'undefined') return '';
  return window.location.hostname || '';
};

export const isTestEnv = () => {
  const host = getHostname();
  return host.includes('test.') || host.includes('putikunn-test') || host.includes('localhost');
};

export const isProdEnv = () => {
  const host = getHostname();
  return host.includes('putikunn.ee') || host.includes('putikunn-migration');
};
