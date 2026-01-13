import * as secp256k1 from '@noble/secp256k1';
import { bech32 } from '@scure/base';

export const KEY_COLORS = [
  { name: 'Purple', value: 'hsl(270, 100%, 60%)' },
  { name: 'Blue', value: 'hsl(210, 100%, 60%)' },
  { name: 'Cyan', value: 'hsl(180, 100%, 50%)' },
  { name: 'Green', value: 'hsl(140, 100%, 50%)' },
  { name: 'Yellow', value: 'hsl(50, 100%, 50%)' },
  { name: 'Orange', value: 'hsl(30, 100%, 55%)' },
  { name: 'Red', value: 'hsl(0, 100%, 60%)' },
  { name: 'Pink', value: 'hsl(330, 100%, 65%)' },
];

export interface NostrKey {
  id: string;
  name: string;
  publicKey: string;
  privateKey: string;
  createdAt: Date;
  color?: string;
}

export interface SignLog {
  id: string;
  keyId: string;
  keyName: string;
  action: string;
  app: string;
  timestamp: Date;
  challengeCode?: string; // For deduplication
}

const BECH32_LIMIT = 1500;

const encodeBech32 = (prefix: string, data: Uint8Array): string => {
  const words = bech32.toWords(data);
  return bech32.encode(prefix, words, BECH32_LIMIT);
};

const decodeBech32 = (encoded: string): { prefix: string; data: Uint8Array } => {
  const decoded = bech32.decode(encoded as `${string}1${string}`, BECH32_LIMIT);
  const data = bech32.fromWords(decoded.words);
  return { prefix: decoded.prefix, data: new Uint8Array(data) };
};

const getXOnlyPublicKey = (secretKey: Uint8Array): Uint8Array => {
  // returns 33b compressed key, strip prefix -> 32b x-only
  return secp256k1.getPublicKey(secretKey, true).slice(1);
};

export const generateKeyPair = (): { publicKey: string; privateKey: string } => {
  const secretKey = secp256k1.utils.randomSecretKey();
  const pubKey = getXOnlyPublicKey(secretKey);

  return {
    publicKey: encodeBech32('npub', pubKey),
    privateKey: encodeBech32('nsec', secretKey),
  };
};

export const derivePublicKey = (nsec: string): string | null => {
  try {
    if (!nsec.startsWith('nsec1')) return null;
    const { prefix, data: secretKey } = decodeBech32(nsec);
    if (prefix !== 'nsec' || secretKey.length !== 32) return null;
    if (!secp256k1.utils.isValidSecretKey(secretKey)) return null;

    const pubKey = getXOnlyPublicKey(secretKey);
    return encodeBech32('npub', pubKey);
  } catch {
    return null;
  }
};

export const isValidNsec = (nsec: string): boolean => {
  try {
    if (!nsec.startsWith('nsec1')) return false;
    const { prefix, data } = decodeBech32(nsec);
    if (prefix !== 'nsec' || data.length !== 32) return false;
    return secp256k1.utils.isValidSecretKey(data);
  } catch {
    return false;
  }
};


export const getStoredKeys = (): NostrKey[] => {
  const stored = localStorage.getItem('nostr-keys');
  if (stored) {
    const keys = JSON.parse(stored);
    return keys.map((k: any) => ({
      ...k,
      createdAt: new Date(k.createdAt),
    }));
  }
  return [];
};

export const saveKey = (key: NostrKey): void => {
  const keys = getStoredKeys();
  keys.push(key);
  localStorage.setItem('nostr-keys', JSON.stringify(keys));
};

export const deleteKey = (id: string): void => {
  const keys = getStoredKeys().filter((k) => k.id !== id);
  localStorage.setItem('nostr-keys', JSON.stringify(keys));
};

export const getSignLogs = (): SignLog[] => {
  const stored = localStorage.getItem('nostr-sign-logs');
  if (stored) {
    const logs = JSON.parse(stored);
    return logs.map((l: any) => ({
      ...l,
      timestamp: new Date(l.timestamp),
    }));
  }
  return [];
};

export const addSignLog = (log: SignLog): void => {
  const logs = getSignLogs();
  logs.unshift(log);
  localStorage.setItem('nostr-sign-logs', JSON.stringify(logs.slice(0, 50)));
};

export const getPin = (): string | null => {
  return localStorage.getItem('nostr-pin');
};

export const setPin = (pin: string): void => {
  localStorage.setItem('nostr-pin', pin);
};

export const getActiveKeyId = (): string | null => {
  return localStorage.getItem('nostr-active-key');
};

export const setActiveKeyId = (id: string): void => {
  localStorage.setItem('nostr-active-key', id);
};
