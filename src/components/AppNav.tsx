import { useEffect, useRef, useState } from 'react';
import { NAV_GROUPS, findItemOrNull, type NavGroup, type Tab } from '../nav';
import type { RouteId } from '../router';

interface Props {
  /** May be the landing page, which is a route with no nav entry. */
  tab: RouteId;
  onSelect: (tab: RouteId) => void;
}

/**
 * Grouped navigation: four group buttons, each opening a menu of modules.
 * Keeps the header a fixed width as modules are added, and the group labels
 * double as a map of the subject rather than an arbitrary filing system.
 */
export function AppNav({ tab, onSelect }: Props) {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const current = findItemOrNull(tab);

  // A menu should close when attention moves away from it — a click anywhere
  // else, or Escape. Without both, the menu strands itself open over content.
  useEffect(() => {
    if (!openGroup) return;

    const onPointerDown = (e: PointerEvent) => {
      if (!navRef.current?.contains(e.target as Node)) setOpenGroup(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenGroup(null);
        // Return focus to the button that opened the menu.
        navRef.current?.querySelector<HTMLButtonElement>(`#nav-btn-${openGroup}`)?.focus();
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openGroup]);

  const choose = (next: Tab) => {
    onSelect(next);
    setOpenGroup(null);
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
          onToggle={() => setOpenGroup((g) => (g === group.id ? null : group.id))}
          onChoose={choose}
        />
      ))}
      {/* Which module is open is otherwise only visible inside a closed menu.
          On the landing page there is no module, so there is nothing to name. */}
      <span className="nav-current" aria-live="polite">
        {current?.label ?? ''}
      </span>
    </nav>
  );
}

function Group({
  group,
  tab,
  isCurrentGroup,
  open,
  onToggle,
  onChoose,
}: {
  group: NavGroup;
  tab: RouteId;
  isCurrentGroup: boolean;
  open: boolean;
  onToggle: () => void;
  onChoose: (tab: Tab) => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Moving into an open menu with the keyboard should land on an item.
  useEffect(() => {
    if (open) menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, [open]);

  const onMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const buttons = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === 'ArrowDown' ? i + 1 : i - 1;
    buttons[(next + buttons.length) % buttons.length]?.focus();
  };

  return (
    <div className="nav-group">
      <button
        id={`nav-btn-${group.id}`}
        className={`nav-item nav-group-btn ${isCurrentGroup ? 'nav-active' : ''}`}
        onClick={onToggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={`nav-menu-${group.id}`}
      >
        {group.label}
        <span className="nav-caret" aria-hidden="true">
          ▾
        </span>
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
              <span className="nav-menu-label">{item.label}</span>
              <span className="nav-menu-blurb">{item.blurb}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
