/**
 * Node API Key management — sessionStorage only
 * 
 * Stores the user-supplied NexArt Node API key for attestation/recertification.
 * Never persisted to localStorage or database.
 */

const SESSION_KEY = 'recanon.nodeApiKey';

export function getNodeApiKey(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function setNodeApiKey(key: string): void {
  sessionStorage.setItem(SESSION_KEY, key);
}

export function clearNodeApiKey(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

export function hasNodeApiKey(): boolean {
  return !!getNodeApiKey();
}
