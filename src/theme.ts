/**
 * Light/dark theme preference.
 *
 * Three states, not two. "System" is the default and the one most readers want
 * — it follows the operating system and changes with it, including when the OS
 * switches at dusk. An explicit light or dark choice pins the app regardless.
 * A two-state toggle cannot express "follow my system", which is why it is
 * worth carrying the third.
 *
 * The choice is a per-viewer convenience, so it lives in `localStorage` rather
 * than in the URL: a link shared with a class should open in the reader's own
 * preference, not the sender's.
 */
export type Theme = 'system' | 'light' | 'dark';

export const THEMES: Theme[] = ['system', 'light', 'dark'];
export const THEME_KEY = 'matvista-theme';

export function isTheme(v: unknown): v is Theme {
  return v === 'system' || v === 'light' || v === 'dark';
}

/**
 * Read the stored preference. Storage can throw outright — Safari in private
 * mode, or a browser set to block site data — so every access is guarded and
 * falls back to following the system.
 */
export function readTheme(): Theme {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    return raw === 'dark' ? 'dark' : 'dark';
  } catch {
    return 'dark';
  }
}

export function storeTheme(theme: Theme): void {
  try {
    if (theme === 'system') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Nothing to do: the theme still applies for this page view.
  }
}

/**
 * Apply a preference to the document.
 *
 * "System" removes the attribute entirely rather than writing a resolved value,
 * so the `prefers-color-scheme` media query stays in charge and the page keeps
 * following the OS if it changes while open.
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}
