const THEME_STYLE_ID = 'jellyfin-featured-theme-tokens';

const themeTokenDefaults: Record<string, string> = {
  '--ec-theme-primary': 'var(--jf-palette-primary-main, var(--theme-primary-color, var(--primary-accent-color, var(--accent, #00a4dc))))',
  '--ec-theme-primary-dark': 'var(--jf-palette-primary-dark, var(--ec-theme-primary))',
  '--ec-theme-primary-contrast': 'var(--jf-palette-primary-contrastText, #fff)',
  '--ec-theme-secondary': 'var(--jf-palette-secondary-main, var(--ec-theme-primary))',
  '--ec-theme-secondary-contrast': 'var(--jf-palette-secondary-contrastText, var(--ec-theme-primary-contrast))',
  '--ec-theme-background': 'var(--jf-palette-background-default, #101010)',
  '--ec-theme-paper': 'var(--jf-palette-background-paper, #202020)',
  '--ec-theme-appbar': 'var(--jf-palette-AppBar-defaultBg, var(--ec-theme-paper))',
  '--ec-theme-text-primary': 'var(--jf-palette-text-primary, #fff)',
  '--ec-theme-text-secondary': 'var(--jf-palette-text-secondary, var(--ec-theme-text-primary))',
  '--ec-theme-divider': 'var(--jf-palette-divider, rgb(255 255 255 / .14))',
  '--ec-theme-action-hover': 'var(--jf-palette-action-hover, rgb(255 255 255 / .08))',
  '--ec-theme-action-focus': 'var(--jf-palette-action-focus, rgb(255 255 255 / .12))',
  '--ec-theme-contained': 'var(--jf-palette-Button-inheritContainedBg, rgb(255 255 255 / .2))',
  '--ec-theme-contained-hover': 'var(--jf-palette-Button-inheritContainedHoverBg, rgb(255 255 255 / .3))',
  '--ec-theme-error': 'var(--jf-palette-error-main, #d32f2f)',
  '--ec-theme-error-light': 'var(--jf-palette-error-light, #ffb4ab)',
  '--ec-theme-error-contrast': 'var(--jf-palette-error-contrastText, #fff)',
  '--ec-theme-radius': 'var(--jf-card-borderRadius, .25rem)'
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
