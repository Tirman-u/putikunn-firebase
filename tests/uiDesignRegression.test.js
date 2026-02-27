import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (file) => readFileSync(file, 'utf8');

describe('UI design regressions', () => {
  it('applies dark:bg-black only under .dark theme root', () => {
    const css = read('src/index.css');

    expect(css).toContain('.dark .min-h-screen.dark\\:bg-black {');
    expect(css).not.toMatch(/^[ \t]*\.min-h-screen\.dark\\:bg-black \{/m);
  });

  it('does not color leaderboard rows warm for top ranks', () => {
    const source = read('src/components/leaderboard/PuttingRecords.jsx');

    expect(source).not.toContain('bg-[#FFF4DB]/80');
    expect(source).not.toContain('dark:bg-[#443E1E]/45');
    expect(source).toContain("const rowBase = isCurrentUser ? 'bg-[#E7F7F2]/70 dark:bg-[#183134]/55' : '';");
  });

  it('keeps Flight Path palette tokens in theme css', () => {
    const css = read('src/index.css');
    const requiredTokens = ['#14bab6', '#007377', '#f59e0b', '#e7f7f2', '#fff4db', '#1a2b2e'];

    for (const token of requiredTokens) {
      expect(css).toContain(token);
    }
  });
});
