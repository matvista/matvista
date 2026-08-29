// @vitest-environment jsdom
/**
 * The debounced history write, against a URL that moved under it.
 *
 * `useRoute` keeps the route in memory and writes it to `history` on a 200 ms
 * trailing debounce, so a slider drag produces one write instead of one per
 * frame. `adopt` cancels a pending write when a `hashchange` says the reader
 * navigated — but a `hashchange` is delivered as a task, so between the address
 * bar changing and the event arriving there is a window in which the store
 * still believes its own pending write is the newest thing. If the timer comes
 * due inside that window it calls `replaceState` over the reader's navigation
 * *and* records the result as what it last wrote, after which `adopt` compares
 * the two, finds them equal, and adopts nothing. The navigation is gone.
 *
 * `history.replaceState` is the exact shape of that window and is what these
 * tests use to reach it: by specification it changes the URL and fires no
 * `hashchange`, which is a URL that has moved with the event not yet in.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { useRouteString } from './useRoute';

const WRITE_DELAY = 200;
const tick = () => new Promise((r) => setTimeout(r, 0));
const afterTheDebounce = () => new Promise((r) => setTimeout(r, WRITE_DELAY + 60));

let setParam: ((value: string) => void) | null = null;

function Probe() {
  const [value, set] = useRouteString('plane', '110');
  setParam = set;
  return <span data-testid="plane">{value}</span>;
}

/** Mount the probe on `hash`, with the store having adopted it. */
async function mountAt(hash: string) {
  window.location.hash = hash;
  await act(async () => {
    await tick();
  });
  await act(async () => {
    render(<Probe />);
  });
}

afterEach(() => {
  cleanup();
  setParam = null;
  window.location.hash = '';
});

describe('a queued history write and a URL that moved', () => {
  /**
   * The non-vacuity half. If the debounce stopped writing at all the test
   * below would pass for the wrong reason, so this pins that a pending write
   * still lands, and still lands late rather than immediately.
   */
  it('still writes the pending change when nothing else moved the URL', async () => {
    await mountAt('#/miller?plane=110');
    act(() => setParam!('300'));
    // Trailing debounce: in memory at once, in the address bar later.
    expect(window.location.hash).toBe('#/miller?plane=110');
    await act(async () => {
      await afterTheDebounce();
    });
    expect(window.location.hash).toBe('#/miller?plane=300');
  });

  it('does not overwrite a navigation that landed while the write was queued', async () => {
    await mountAt('#/miller?plane=110');
    act(() => setParam!('300'));

    // The reader goes somewhere — a bookmark, an edited URL, a link. The URL
    // is theirs from this instant; the `hashchange` has not arrived yet.
    window.history.replaceState(null, '', '#/miller?plane=200');
    expect(window.location.hash).toBe('#/miller?plane=200');

    await act(async () => {
      await afterTheDebounce();
    });
    // Without the guard this reads `#/miller?plane=300` — the queued write,
    // laid over a page the reader had already left.
    expect(window.location.hash).toBe('#/miller?plane=200');
  });

  /**
   * And the store must not be left believing the stale route either: whatever
   * the address bar ends up holding, the rendered value has to agree with it,
   * or the next write reintroduces the page the reader left.
   */
  it('leaves the rendered route agreeing with the address bar', async () => {
    await mountAt('#/miller?plane=110');
    act(() => setParam!('300'));
    window.history.replaceState(null, '', '#/miller?plane=200');
    await act(async () => {
      await afterTheDebounce();
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      await tick();
    });
    expect(window.location.hash).toBe('#/miller?plane=200');
    expect(document.querySelector('[data-testid="plane"]')!.textContent).toBe('200');
  });
});
