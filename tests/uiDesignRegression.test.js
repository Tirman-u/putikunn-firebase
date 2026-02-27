import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (file) => readFileSync(file, 'utf8');
const readBin = (file) => readFileSync(file);

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

  it('uses compact icon-only HomeButton by default', () => {
    const source = read('src/components/ui/home-button.jsx');

    expect(source).toContain('showLabel = false');
    expect(source).toContain("const compactClasses = 'h-12 w-12 justify-center p-0';");
    expect(source).toContain('aria-label={label}');
  });

  it('renders a subtle owl watermark on Home screen background', () => {
    const source = read('src/pages/Home.jsx');

    expect(source).toContain('src="/wisedisc-owl-light.png"');
    expect(source).toContain('src="/wisedisc-owl-dark.png"');
    expect(source).toContain('fixed bottom-20 right-2');
    expect(source).toContain('sm:absolute sm:-bottom-10 sm:-right-8');
    expect(source).toContain('opacity-[0.12]');
    expect(source).toContain('opacity-[0.18]');
  });

  it('uses Wisedisc branding in metadata and login', () => {
    const html = read('index.html');
    const manifest = read('public/manifest.json');
    const login = read('src/pages/Login.jsx');

    expect(html).toContain('Wisedisc');
    expect(manifest).toContain('"name": "Wisedisc"');
    expect(login).toContain("import BrandLogo from '@/components/ui/brand-logo';");
    expect(login).toContain('<BrandLogo className="justify-center" heightClass="h-9 sm:h-10" />');

    expect(html).not.toContain('Putikunn');
    expect(manifest).not.toContain('Putikunn');
    expect(login).not.toContain('>Putikunn<');
  });

  it('ships Wisedisc favicon files', () => {
    const files = ['public/favicon-16x16.png', 'public/favicon-32x32.png', 'public/favicon.ico'];

    for (const file of files) {
      expect(existsSync(file)).toBe(true);
      expect(readBin(file).byteLength).toBeGreaterThan(32);
    }
  });
});
