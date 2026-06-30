import { useSyncExternalStore } from 'react';

function subscribe(callback: () => void): () => void {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getSnapshot(): boolean {
  return navigator.onLine;
}

export function useNetworkStatus(): { isOnline: boolean } {
  const isOnline = useSyncExternalStore(subscribe, getSnapshot, () => true);
  return { isOnline };
}
