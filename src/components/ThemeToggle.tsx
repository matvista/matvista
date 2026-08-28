import { useEffect, useState } from 'react';
import { THEMES, type Theme, applyTheme, readTheme, storeTheme } from '../theme';

const LABEL: Record<Theme, string> = {
  system: 'Auto',
  light: 'Light',
  dark: 'Dark',
};

const TITLE: Record<Theme, string> = {
  system: 'Follow the system setting',
  light: 'Always light',
  dark: 'Always dark',
};

/**
 * A three-way theme control: follow the system, or pin light or dark.
 *
 * A radiogroup rather than three toggle buttons, because the options are
 * mutually exclusive — exactly one is always in effect, which is what radio
 * semantics say and what `aria-pressed` on three buttons would not. Arrow keys
 * move between them and only the active one is in the tab order, which is the
 * expected behaviour for a radio group.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => readTheme());

  // The boot script in index.html has already applied the stored value; this
  // keeps the document in step with any later change.
  useEffect(() => {
    applyTheme(theme);
    storeTheme(theme);
  }, [theme]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const i = THEMES.indexOf(theme);
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      setTheme(THEMES[(i + 1) % THEMES.length]);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      setTheme(THEMES[(i - 1 + THEMES.length) % THEMES.length]);
    }
  };

  return (
    <div className="theme-toggle" role="radiogroup" aria-label="Colour theme" onKeyDown={onKeyDown}>
      {THEMES.map((t) => (
        <button
          key={t}
          role="radio"
          aria-checked={theme === t}
          tabIndex={theme === t ? 0 : -1}
          title={TITLE[t]}
          className={`theme-option ${theme === t ? 'theme-option-on' : ''}`}
          onClick={() => setTheme(t)}
        >
          {LABEL[t]}
        </button>
      ))}
    </div>
  );
}
