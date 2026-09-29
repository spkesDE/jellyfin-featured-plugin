const THEME_STYLE_ID = 'jellyfin-featured-theme-tokens';

const themeTokenDefaults: Record<string, string> = {
  '--featured-theme-primary':
    'var(--jf-palette-primary-main, var(--theme-primary-color, var(--primary-accent-color, var(--accent, #00a4dc))))',
  '--featured-theme-primary-dark': 'var(--jf-palette-primary-dark, var(--featured-theme-primary))',
  '--featured-theme-primary-contrast': 'var(--jf-palette-primary-contrastText, #fff)',
  '--featured-theme-secondary': 'var(--jf-palette-secondary-main, var(--featured-theme-primary))',
  '--featured-theme-secondary-contrast':
    'var(--jf-palette-secondary-contrastText, var(--featured-theme-primary-contrast))',
  '--featured-theme-background': 'var(--jf-palette-background-default, #101010)',
  '--featured-theme-paper': 'var(--jf-palette-background-paper, #202020)',
  '--featured-theme-appbar': 'var(--jf-palette-AppBar-defaultBg, var(--featured-theme-paper))',
  '--featured-theme-text-primary': 'var(--jf-palette-text-primary, #fff)',
  '--featured-theme-text-secondary': 'var(--jf-palette-text-secondary, var(--featured-theme-text-primary))',
  '--featured-theme-divider': 'var(--jf-palette-divider, rgb(255 255 255 / .14))',
  '--featured-theme-action-hover': 'var(--jf-palette-action-hover, rgb(255 255 255 / .08))',
  '--featured-theme-action-focus': 'var(--jf-palette-action-focus, rgb(255 255 255 / .12))',
  '--featured-theme-contained': 'var(--jf-palette-Button-inheritContainedBg, rgb(255 255 255 / .2))',
  '--featured-theme-contained-hover': 'var(--jf-palette-Button-inheritContainedHoverBg, rgb(255 255 255 / .3))',
  '--featured-theme-error': 'var(--jf-palette-error-main, #d32f2f)',
  '--featured-theme-error-light': 'var(--jf-palette-error-light, #ffb4ab)',
  '--featured-theme-error-contrast': 'var(--jf-palette-error-contrastText, #fff)',
  '--featured-theme-radius': 'var(--jf-card-borderRadius, .25rem)'
};

export function injectJellyfinThemeTokens(): void {
  if (document.getElementById(THEME_STYLE_ID)) return;
  const computed = getComputedStyle(document.documentElement);
  const declarations = Object.entries(themeTokenDefaults)
    .filter(([name]) => computed.getPropertyValue(name).trim().length === 0)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n');
  const style = document.createElement('style');
  style.id = THEME_STYLE_ID;
  style.textContent = `:root {\n${declarations}\n}`;
  (document.head || document.documentElement).appendChild(style);
}
