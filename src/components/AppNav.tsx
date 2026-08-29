import { useCallback, useEffect, useRef, useState } from 'react';
import { NAV_GROUPS, findItemOrNull, type NavGroup, type Tab } from '../nav';
import { MODULE_MARKS } from './moduleMarks';
import type { RouteId } from '../router';

interface Props {
  /** May be the landing page, which is a route with no nav entry. */
  tab: RouteId;
  onSelect: (tab: RouteId) => void;
}

/**
 * How long the pointer has to rest on a tab before its menu opens, and how long
 * the menu survives after the pointer leaves.
 *
 * The open delay exists because the strip sits directly under the cursor's path
 * to everything else in the header; without it, crossing the header on the way
 * to the theme toggle deals four menus in a row. 120ms is under the ~200ms most
 * readers register as a wait, but long enough that a pass-through never trips
 * it.
 *
 * The close delay is twice that, and it is not symmetry that is wanted here.
 * Leaving the button means the pointer is in transit, usually *into* the menu,
 * and a menu that vanishes on the way to itself cannot be used at all. 250ms
 * covers a diagonal move from the middle of a tab to the far side of the panel
 * without ever feeling like the menu is refusing to go away.
 */
const OPEN_DELAY_MS = 120;
const CLOSE_DELAY_MS = 250;

/** Which group is open, and whether that opening should take focus with it. */
interface OpenState {
  id: string;
  /**
   * True only on the click/keyboard path. A hover opening must not move focus:
   * the pointer is still moving, and yanking focus into a menu under a passing
   * cursor takes it away from whatever the reader was actually using.
   */
  focusFirst: boolean;
}

/**
 * Grouped navigation: four group tabs, each opening a menu of modules.
 *
 * Keeps the header a fixed width as modules are added, and the group labels
 * double as a map of the subject rather than an arbitrary filing system.
 *
 * Menus open on hover for a mouse and on click for everything else. The two
 * paths are additive, not alternative — the click path is the whole behaviour
 * on touch and by keyboard, and it is still what a mouse user gets when they
 * click the tab they are pointing at. Hover is gated on a pointer that really
 * hovers (`(hover: hover) and (pointer: fine)` *and* `pointerType === 'mouse'`),
 * because a touchscreen fires a synthetic hover on tap and a menu that opens
 * under the fingertip and then eats the tap is worse than no menu at all.
 */
export function AppNav({ tab, onSelect }: Props) {
  const [open, setOpen] = useState<OpenState | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  /** Re-read from `matchMedia` rather than assumed: a hybrid laptop changes it. */
  const canHover = useRef(false);
  const current = findItemOrNull(tab);
  const openGroup = open?.id ?? null;

  const cancelOpen = useCallback(() => {
    if (openTimer.current !== null) {
      window.clearTimeout(openTimer.current);
      openTimer.current = null;
    }
  }, []);
  const cancelClose = useCallback(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);
  const clearTimers = useCallback(() => {
    cancelOpen();
    cancelClose();
  }, [cancelOpen, cancelClose]);

  // Nothing may outlive the component: a pending open from a fast sweep across
  // the strip would otherwise fire after unmount, or after the pointer has gone.
  useEffect(() => clearTimers, [clearTimers]);

  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    canHover.current = mq.matches;
    const onChange = () => {
      canHover.current = mq.matches;
      if (!mq.matches) clearTimers();
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [clearTimers]);

  const close = useCallback(() => {
    clearTimers();
    setOpen(null);
  }, [clearTimers]);

  // A menu should close when attention moves away from it — a click anywhere
  // else, or Escape. Without both, the menu strands itself open over content.
  // Scrolling and the window losing focus count as attention moving away too:
  // an absolutely positioned panel left open behind a switched-to window is the
  // other way this strands.
  useEffect(() => {
    if (!openGroup) return;

    const onPointerDown = (e: PointerEvent) => {
      if (!navRef.current?.contains(e.target as Node)) close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        // Return focus to the button that opened the menu.
        navRef.current?.querySelector<HTMLButtonElement>(`#nav-btn-${openGroup}`)?.focus();
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', close);
    window.addEventListener('scroll', close, { passive: true });
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', close);
      window.removeEventListener('scroll', close);
    };
  }, [openGroup, close]);

  /** Click and Enter/Space. An already-open menu closes, however it was opened. */
  const toggle = (id: string) => {
    clearTimers();
    setOpen((prev) => (prev?.id === id ? null : { id, focusFirst: true }));
  };

  const onGroupPointerEnter = (id: string, e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || !canHover.current) return;
    // Coming back onto the region cancels a pending close, whether the pointer
    // re-entered the tab or crossed into the panel: the two are one hover region.
    cancelClose();
    if (openGroup === id) return;
    if (openGroup !== null) {
      // Sideways, with a menu already open. No delay — the reader has already
      // said they are reading the strip, and a wait here is what makes a menu
      // bar feel sticky.
      clearTimers();
      setOpen({ id, focusFirst: false });
      return;
    }
    cancelOpen();
    openTimer.current = window.setTimeout(() => {
      openTimer.current = null;
      setOpen({ id, focusFirst: false });
    }, OPEN_DELAY_MS);
  };

  const onGroupPointerLeave = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || !canHover.current) return;
    cancelOpen();
    cancelClose();
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      // One exception to "pointer left, so close": if the keyboard is inside the
      // menu, closing would drop focus onto <body> and lose the reader's place.
      // A stray mouse sweep must not do that. Escape and a click outside still
      // close it, and both put focus somewhere deliberate.
      const menu = navRef.current?.querySelector('.nav-menu');
      if (menu && menu.contains(document.activeElement)) return;
      setOpen(null);
    }, CLOSE_DELAY_MS);
  };

  const choose = (next: Tab) => {
    onSelect(next);
    close();
  };

  return (
    <nav className="app-nav" ref={navRef} aria-label="Modules">
      {NAV_GROUPS.map((group) => (
        <Group
          key={group.id}
          group={group}
          tab={tab}
          isCurrentGroup={group.id === current?.group.id}
          open={openGroup === group.id}
          focusFirst={openGroup === group.id && open?.focusFirst === true}
          onToggle={() => toggle(group.id)}
          onPointerEnter={(e) => onGroupPointerEnter(group.id, e)}
          onPointerLeave={onGroupPointerLeave}
          onChoose={choose}
        />
      ))}
    </nav>
  );
}

function Group({
  group,
  tab,
  isCurrentGroup,
  open,
  focusFirst,
  onToggle,
  onPointerEnter,
  onPointerLeave,
  onChoose,
}: {
  group: NavGroup;
  tab: RouteId;
  isCurrentGroup: boolean;
  open: boolean;
  focusFirst: boolean;
  onToggle: () => void;
  onPointerEnter: (e: React.PointerEvent) => void;
  onPointerLeave: (e: React.PointerEvent) => void;
  onChoose: (tab: Tab) => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Moving into an open menu with the keyboard should land on an item — but
  // only when the keyboard is what opened it. See `OpenState.focusFirst`.
  useEffect(() => {
    if (open && focusFirst) menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, [open, focusFirst]);

  const onMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const buttons = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === 'ArrowDown' ? i + 1 : i - 1;
    buttons[(next + buttons.length) % buttons.length]?.focus();
  };

  return (
    // The tab and its menu are one hover region, and they are one element
    // subtree too, so `pointerleave` here fires only when the pointer has left
    // both — crossing from the button into the panel is not a leave.
    <div className="nav-group" onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave}>
      <button
        id={`nav-btn-${group.id}`}
        className={`nav-item nav-group-btn ${isCurrentGroup ? 'nav-active' : ''}`}
        onClick={onToggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={`nav-menu-${group.id}`}
      >
        {group.label}
        <svg className="nav-caret" viewBox="0 0 10 6" aria-hidden="true" focusable="false">
          <path
            d="M1 1.4L5 4.6 9 1.4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          className="nav-menu"
          id={`nav-menu-${group.id}`}
          role="menu"
          ref={menuRef}
          onKeyDown={onMenuKeyDown}
          aria-label={group.label}
        >
          {group.items.map((item) => (
            <button
              key={item.id}
              role="menuitem"
              className={`nav-menu-item ${item.id === tab ? 'nav-menu-current' : ''}`}
              onClick={() => onChoose(item.id)}
              aria-current={item.id === tab ? 'page' : undefined}
            >
              <span className="nav-menu-mark">{MODULE_MARKS[item.id]}</span>
              <span className="nav-menu-text">
                <span className="nav-menu-label">{item.label}</span>
                <span className="nav-menu-blurb">{item.blurb}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
