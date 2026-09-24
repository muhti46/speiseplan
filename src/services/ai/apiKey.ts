const STORAGE_KEY = 'speiseplan-gemini-key';

// Der Key liegt bewusst nur im localStorage des Geräts (kein Backend vorhanden) -
// er ist damit für jeden mit Zugriff auf dieses Gerät/diesen Browser sichtbar.
export function getApiKey(): string | null {
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setApiKey(key: string): void {
  window.localStorage.setItem(STORAGE_KEY, key.trim());
}

export function clearApiKey(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
