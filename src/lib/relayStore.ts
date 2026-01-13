/**
 * Relay Store - manages the list of Nostr relays
 */

const RELAYS_STORAGE_KEY = 'nostr-vault-relays';

export const DEFAULT_RELAYS = [
  'wss://nos.lol/',
  'wss://nostr.wine/',
  'wss://offchain.pub/',
  'wss://purplepag.es/',
  'wss://relay.damus.io/',
  'wss://relay.primal.net/',
  'wss://relay.snort.social/',
  'wss://nostr.bitcoiner.social/',
  'wss://relay.nostr.band/',
];

export const getRelays = (): string[] => {
  const stored = localStorage.getItem(RELAYS_STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // Fall through to default
    }
  }
  return [...DEFAULT_RELAYS];
};

export const saveRelays = (relays: string[]): void => {
  localStorage.setItem(RELAYS_STORAGE_KEY, JSON.stringify(relays));
};

export const addRelay = (url: string): string[] => {
  const relays = getRelays();
  // Normalize URL
  let normalized = url.trim();
  if (!normalized.startsWith('wss://') && !normalized.startsWith('ws://')) {
    normalized = 'wss://' + normalized;
  }
  if (!normalized.endsWith('/')) {
    normalized += '/';
  }
  
  if (!relays.includes(normalized)) {
    relays.push(normalized);
    saveRelays(relays);
  }
  return relays;
};

export const removeRelay = (url: string): string[] => {
  const relays = getRelays().filter(r => r !== url);
  saveRelays(relays);
  return relays;
};

export const resetRelays = (): string[] => {
  saveRelays([...DEFAULT_RELAYS]);
  return [...DEFAULT_RELAYS];
};
