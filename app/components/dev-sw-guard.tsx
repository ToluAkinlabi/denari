'use client';

import { useEffect } from 'react';

/**
 * Clear stale service worker registrations and old cache buckets.
 * This prevents clients from being stuck on old deployments.
 */
export function DevSwGuard() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => {
        reg.unregister();
      });
    });

    if (typeof caches !== 'undefined') {
      caches.keys().then((keys) => {
        keys.forEach((key) => {
          if (key.startsWith('denari-')) {
            caches.delete(key);
          }
        });
      });
    }
  }, []);

  return null;
}
