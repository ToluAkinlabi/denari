'use client';

import { useEffect } from 'react';

/**
 * Avoid stale localhost service workers breaking Next.js module loading in development.
 */
export function DevSwGuard() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => {
        reg.unregister();
      });
    });
  }, []);

  return null;
}
