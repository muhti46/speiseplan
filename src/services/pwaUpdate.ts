import { registerSW } from 'virtual:pwa-register';

// Wie oft eine geöffnete App im Hintergrund nach einer neuen Version fragt.
const UPDATE_INTERVAL_MS = 30 * 60 * 1000;

let registration: ServiceWorkerRegistration | undefined;

/**
 * Registriert den Service Worker und sucht aktiv nach Updates: beim Start, alle 30 Minuten
 * und jedes Mal, wenn die App wieder in den Vordergrund kommt. Ohne das bleibt eine
 * installierte Android-App, die nur im Hintergrund pausiert, oft lange auf der alten Version -
 * und Neuinstallieren (das alle Daten löscht) wirkt wie der einzige Weg zum Update.
 * Im autoUpdate-Modus lädt die Seite nach der Aktivierung der neuen Version selbst neu;
 * die Daten in IndexedDB bleiben dabei unverändert erhalten.
 */
export function initPwaUpdates(): void {
  registerSW({
    immediate: true,
    onRegisteredSW(_url, reg) {
      registration = reg;
      if (!reg) return;
      window.setInterval(() => reg.update().catch(() => undefined), UPDATE_INTERVAL_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => undefined);
      });
    },
  });
}

/** Fragt sofort nach einer neuen Version. `true` = Update gefunden, die App lädt gleich neu. */
export async function checkForUpdate(): Promise<boolean> {
  if (!registration) return false;
  await registration.update();
  return Boolean(registration.installing || registration.waiting);
}
