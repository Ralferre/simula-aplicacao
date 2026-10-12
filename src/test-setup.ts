import { afterEach } from 'vitest';

// uPlot calls window.matchMedia at import time; jsdom doesn't implement it.
// Provide a minimal stub so components importing uPlot can render in tests.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList;
}

// Ensure React Testing Library unmounts components between tests so queries do
// not see leftover DOM from previous renders. Guarded so node-environment tests
// (no DOM) are unaffected.
afterEach(async () => {
  if (typeof document !== 'undefined') {
    const { cleanup } = await import('@testing-library/react');
    cleanup();
  }
});
