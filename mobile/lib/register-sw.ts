/**
 * Register the service worker for PWA offline support.
 * Only runs on web — no-op on native platforms.
 */
import { Platform } from 'react-native';

export function registerServiceWorker(): void {
  if (Platform.OS !== 'web') return;
  if (!('serviceWorker' in navigator)) return;

  const register = () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('SW registration failed:', error);
    });
  };

  if (document.readyState === 'complete') {
    register();
  } else {
    window.addEventListener('load', register);
  }
}
