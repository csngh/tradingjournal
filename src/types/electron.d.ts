/**
 * Exposed by electron/preload.js, only inside the packaged Mac app, never on the plain web
 * version. Always check for presence before calling: `window.electronAPI` is undefined when
 * this page is loaded in a regular browser.
 */
export {};

declare global {
  interface Window {
    electronAPI?: {
      touchIDAvailable: () => Promise<boolean>;
      unlockWithTouchID: () => Promise<{ ok: boolean; error?: string }>;
    };
  }
}
