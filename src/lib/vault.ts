/**
 * Encrypted Vault – AES-256-GCM + PBKDF2
 * Stores all wallet data encrypted with the user PIN.
 * PIN is optional - when disabled, data is stored unencrypted.
 */

import type { NostrKey, SignLog } from './keyStore';

export interface VaultData {
  keys: NostrKey[];
  logs: SignLog[];
  defaultKeyId?: string;
}

export interface VaultSettings {
  pinEnabled: boolean;
}

// New storage keys (prevents format-mismatch "data loss")
const ENCRYPTED_STORAGE_KEY = 'nostr-vault-encrypted';
const PLAIN_STORAGE_KEY = 'nostr-vault-plain';

// Legacy key used by older versions (could contain either JSON or encrypted payload)
const LEGACY_STORAGE_KEY = 'nostr-vault';

const SALT_KEY = 'nostr-vault-salt';
const SETTINGS_KEY = 'nostr-vault-settings';
const ITERATIONS = 100_000;

// ---------- Helpers ----------

const getRandomBytes = (len: number): Uint8Array => crypto.getRandomValues(new Uint8Array(len));

const encode = (s: string): Uint8Array => new TextEncoder().encode(s);
const decode = (buf: Uint8Array): string => new TextDecoder().decode(buf);

const toBase64 = (buf: Uint8Array): string => btoa(String.fromCharCode(...buf));
const fromBase64 = (b64: string): Uint8Array => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

const isProbablyJson = (value: string): boolean => {
  const t = value.trim();
  return t.startsWith('{') || t.startsWith('[');
};

const saveVaultSettings = (settings: VaultSettings): void => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

const migrateLegacyStorageIfNeeded = (): void => {
  const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!legacy) return;

  // Legacy could be either JSON (unencrypted) or base64 (encrypted)
  if (isProbablyJson(legacy)) {
    if (!localStorage.getItem(PLAIN_STORAGE_KEY)) {
      localStorage.setItem(PLAIN_STORAGE_KEY, legacy);
    }
    saveVaultSettings({ pinEnabled: false });
  } else {
    if (!localStorage.getItem(ENCRYPTED_STORAGE_KEY)) {
      localStorage.setItem(ENCRYPTED_STORAGE_KEY, legacy);
    }
    saveVaultSettings({ pinEnabled: true });
  }

  localStorage.removeItem(LEGACY_STORAGE_KEY);
};

// ---------- Settings ----------

export const getVaultSettings = (): VaultSettings => {
  migrateLegacyStorageIfNeeded();

  const hasEncrypted = !!localStorage.getItem(ENCRYPTED_STORAGE_KEY);
  const hasPlain = !!localStorage.getItem(PLAIN_STORAGE_KEY);

  const stored = localStorage.getItem(SETTINGS_KEY);
  const base: VaultSettings = stored ? JSON.parse(stored) : { pinEnabled: false };

  // Self-heal: prefer the storage that actually exists
  if (hasEncrypted && !hasPlain) {
    if (!base.pinEnabled) saveVaultSettings({ pinEnabled: true });
    return { pinEnabled: true };
  }
  if (!hasEncrypted && hasPlain) {
    if (base.pinEnabled) saveVaultSettings({ pinEnabled: false });
    return { pinEnabled: false };
  }

  // If both exist (shouldn't happen), prefer encrypted unless user explicitly disabled PIN
  if (hasEncrypted && hasPlain && !stored) {
    saveVaultSettings({ pinEnabled: true });
    return { pinEnabled: true };
  }

  return base;
};

// ---------- Key derivation ----------

const getSalt = (): Uint8Array => {
  const stored = localStorage.getItem(SALT_KEY);
  if (stored) return fromBase64(stored);
  const salt = getRandomBytes(16);
  localStorage.setItem(SALT_KEY, toBase64(salt));
  return salt;
};

const deriveKey = async (pin: string): Promise<CryptoKey> => {
  const salt = getSalt();
  const pinBytes = encode(pin);
  const baseKey = await crypto.subtle.importKey('raw', pinBytes.buffer as ArrayBuffer, 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

// ---------- Encrypt / Decrypt ----------

const encrypt = async (data: VaultData, key: CryptoKey): Promise<string> => {
  const iv = getRandomBytes(12);
  const plain = encode(JSON.stringify(data));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv.buffer as ArrayBuffer }, key, plain.buffer as ArrayBuffer);
  // Prepend IV to cipher
  const combined = new Uint8Array(iv.length + cipher.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipher), iv.length);
  return toBase64(combined);
};

const decrypt = async (payload: string, key: CryptoKey): Promise<VaultData> => {
  const combined = fromBase64(payload);
  const iv = combined.slice(0, 12);
  const cipher = combined.slice(12);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv.buffer as ArrayBuffer }, key, cipher.buffer as ArrayBuffer);
  const json = decode(new Uint8Array(plain));
  const parsed = JSON.parse(json);
  // Rehydrate dates and preserve all fields
  return {
    keys: (parsed.keys ?? []).map((k: any) => ({ ...k, createdAt: new Date(k.createdAt) })),
    logs: (parsed.logs ?? []).map((l: any) => ({ ...l, timestamp: new Date(l.timestamp) })),
    defaultKeyId: parsed.defaultKeyId,
  };
};

// ---------- Unencrypted storage (when PIN disabled) ----------

const parseRawData = (json: string): VaultData => {
  const parsed = JSON.parse(json);
  return {
    keys: (parsed.keys ?? []).map((k: any) => ({ ...k, createdAt: new Date(k.createdAt) })),
    logs: (parsed.logs ?? []).map((l: any) => ({ ...l, timestamp: new Date(l.timestamp) })),
    defaultKeyId: parsed.defaultKeyId,
  };
};

export const loadUnencryptedVault = (): VaultData => {
  migrateLegacyStorageIfNeeded();

  const stored = localStorage.getItem(PLAIN_STORAGE_KEY);
  if (!stored) return { keys: [], logs: [] };
  try {
    return parseRawData(stored);
  } catch {
    return { keys: [], logs: [] };
  }
};

export const saveUnencryptedVault = (data: VaultData): void => {
  localStorage.setItem(PLAIN_STORAGE_KEY, JSON.stringify(data));
  saveVaultSettings({ pinEnabled: false });
};

// ---------- Public API ----------

export const vaultExists = (): boolean => {
  migrateLegacyStorageIfNeeded();
  return !!localStorage.getItem(ENCRYPTED_STORAGE_KEY);
};

export const createVault = async (pin: string): Promise<void> => {
  migrateLegacyStorageIfNeeded();

  const key = await deriveKey(pin);
  const empty: VaultData = { keys: [], logs: [] };
  const payload = await encrypt(empty, key);

  localStorage.setItem(ENCRYPTED_STORAGE_KEY, payload);
  localStorage.removeItem(PLAIN_STORAGE_KEY);
  saveVaultSettings({ pinEnabled: true });
};

export const unlockVault = async (pin: string): Promise<VaultData> => {
  migrateLegacyStorageIfNeeded();

  const payload = localStorage.getItem(ENCRYPTED_STORAGE_KEY);
  if (!payload) throw new Error('Vault not found');
  const key = await deriveKey(pin);
  return decrypt(payload, key); // Will throw if wrong PIN
};

export const saveVault = async (pin: string, data: VaultData): Promise<void> => {
  migrateLegacyStorageIfNeeded();

  const key = await deriveKey(pin);
  const payload = await encrypt(data, key);
  localStorage.setItem(ENCRYPTED_STORAGE_KEY, payload);
};

export const deleteVault = (): void => {
  migrateLegacyStorageIfNeeded();

  localStorage.removeItem(ENCRYPTED_STORAGE_KEY);
  localStorage.removeItem(PLAIN_STORAGE_KEY);
  localStorage.removeItem(SALT_KEY);
  saveVaultSettings({ pinEnabled: false });
};

export const disablePin = (currentData: VaultData): void => {
  migrateLegacyStorageIfNeeded();

  // Convert encrypted vault to unencrypted
  localStorage.setItem(PLAIN_STORAGE_KEY, JSON.stringify(currentData));
  localStorage.removeItem(ENCRYPTED_STORAGE_KEY);
  localStorage.removeItem(SALT_KEY);
  saveVaultSettings({ pinEnabled: false });
};

export const enablePinWithData = async (pin: string, data: VaultData): Promise<void> => {
  migrateLegacyStorageIfNeeded();

  const key = await deriveKey(pin);
  const payload = await encrypt(data, key);
  localStorage.setItem(ENCRYPTED_STORAGE_KEY, payload);
  localStorage.removeItem(PLAIN_STORAGE_KEY);
  saveVaultSettings({ pinEnabled: true });
};
