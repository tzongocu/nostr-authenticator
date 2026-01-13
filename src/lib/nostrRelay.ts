/**
 * Nostr Relay Connection & NIP-04 DM Decryption
 */

import * as secp256k1 from '@noble/secp256k1';
import { bech32 } from '@scure/base';
import type { NostrKey } from './keyStore';
import { getRelays } from './relayStore';

export interface NostrDM {
  id: string;
  keyId: string;
  keyName: string;
  senderPubkey: string;
  content: string;
  decryptedContent: string | null;
  timestamp: Date;
  relay: string;
}

// Get current relays from store
const getActiveRelays = (): string[] => getRelays();

const BECH32_LIMIT = 1500;

// Decode bech32 key to bytes
const decodeBech32 = (encoded: string): Uint8Array => {
  const decoded = bech32.decode(encoded as `${string}1${string}`, BECH32_LIMIT);
  return new Uint8Array(bech32.fromWords(decoded.words));
};

// Get hex pubkey from npub
export const npubToHex = (npub: string): string => {
  const bytes = decodeBech32(npub);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
};

// Get secret key bytes from nsec
const nsecToBytes = (nsec: string): Uint8Array => {
  return decodeBech32(nsec);
};

// NIP-04 shared secret derivation
const getSharedSecret = (privateKeyHex: string, publicKeyHex: string): Uint8Array => {
  const privBytes = hexToBytes(privateKeyHex);
  const pubBytes = hexToBytes('02' + publicKeyHex); // Add compressed prefix
  const shared = secp256k1.getSharedSecret(privBytes, pubBytes);
  return shared.slice(1, 33); // x-coordinate only
};

const hexToBytes = (hex: string): Uint8Array => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
};

const bytesToHex = (bytes: Uint8Array): string => {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
};

// NIP-04 decrypt
export const decryptNIP04 = async (
  encryptedContent: string,
  privateKey: string,
  senderPubkeyHex: string
): Promise<string | null> => {
  try {
    const [ciphertext, ivBase64] = encryptedContent.split('?iv=');
    if (!ciphertext || !ivBase64) return null;

    const privBytes = nsecToBytes(privateKey);
    const privHex = bytesToHex(privBytes);
    
    const sharedSecret = getSharedSecret(privHex, senderPubkeyHex);
    
    const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));
    const cipherBytes = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));

    const key = await crypto.subtle.importKey(
      'raw',
      sharedSecret.buffer as ArrayBuffer,
      { name: 'AES-CBC' },
      false,
      ['decrypt']
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-CBC', iv: iv.buffer as ArrayBuffer },
      key,
      cipherBytes.buffer as ArrayBuffer
    );

    return new TextDecoder().decode(decrypted);
  } catch (e) {
    console.error('NIP-04 decrypt error:', e);
    return null;
  }
};

export type DMCallback = (dm: NostrDM) => void;

class RelayConnection {
  private ws: WebSocket | null = null;
  private url: string;
  private keys: NostrKey[];
  private subscriptionId: string;
  private onDM: DMCallback;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private seenEvents = new Set<string>();
  private isDestroyed = false;
  private static readonly MAX_SEEN_EVENTS = 300;

  constructor(url: string, keys: NostrKey[], onDM: DMCallback) {
    this.url = url;
    this.keys = keys;
    this.subscriptionId = `dm-${Math.random().toString(36).slice(2, 10)}`;
    this.onDM = onDM;
  }

  connect() {
    if (this.isDestroyed) return;
    if (this.ws?.readyState === WebSocket.OPEN) return;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        if (this.isDestroyed) {
          this.ws?.close();
          return;
        }
        console.log(`[Relay] Connected to ${this.url}`);
        this.subscribe();
      };

      this.ws.onmessage = async (event) => {
        if (this.isDestroyed) return;
        try {
          const data = JSON.parse(event.data);
          if (data[0] === 'EVENT' && data[1] === this.subscriptionId) {
            await this.handleEvent(data[2]);
          }
        } catch (e) {
          console.error('[Relay] Message parse error:', e);
        }
      };

      this.ws.onclose = () => {
        console.log(`[Relay] Disconnected from ${this.url}`);
        if (!this.isDestroyed) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = () => {
        // Silent error - will trigger onclose
      };
    } catch (e) {
      console.error(`[Relay] Failed to connect to ${this.url}:`, e);
      if (!this.isDestroyed) {
        this.scheduleReconnect();
      }
    }
  }

  private subscribe() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    // Build filter for DMs (kind 4) to any of our pubkeys
    const pubkeys = this.keys.map(k => npubToHex(k.publicKey));
    
    const filter = {
      kinds: [4], // NIP-04 encrypted DMs
      '#p': pubkeys, // Tagged to our pubkeys
      limit: 20,
    };

    const req = JSON.stringify(['REQ', this.subscriptionId, filter]);
    this.ws.send(req);
    console.log(`[Relay] Subscribed to DMs on ${this.url}`);
  }

  private async handleEvent(event: any) {
    // Deduplicate
    if (this.seenEvents.has(event.id)) return;
    this.seenEvents.add(event.id);
    
    // Limit seenEvents size to prevent memory leak
    if (this.seenEvents.size > RelayConnection.MAX_SEEN_EVENTS) {
      const arr = Array.from(this.seenEvents);
      this.seenEvents = new Set(arr.slice(-RelayConnection.MAX_SEEN_EVENTS / 2));
    }

    // Find which key this DM is for
    const pTags = event.tags.filter((t: string[]) => t[0] === 'p');
    const recipientHex = pTags.length > 0 ? pTags[0][1] : null;
    
    const targetKey = this.keys.find(k => npubToHex(k.publicKey) === recipientHex);
    if (!targetKey) return;

    // Decrypt the message
    const decrypted = await decryptNIP04(
      event.content,
      targetKey.privateKey,
      event.pubkey
    );

    const dm: NostrDM = {
      id: event.id,
      keyId: targetKey.id,
      keyName: targetKey.name,
      senderPubkey: event.pubkey,
      content: event.content,
      decryptedContent: decrypted,
      timestamp: new Date(event.created_at * 1000),
      relay: this.url,
    };

    this.onDM(dm);
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || this.isDestroyed) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isDestroyed) {
        this.connect();
      }
    }, 10000); // Increased to 10s for battery efficiency
  }

  updateKeys(keys: NostrKey[]) {
    this.keys = keys;
    if (this.ws?.readyState === WebSocket.OPEN) {
      // Unsubscribe and resubscribe with new keys
      const unsub = JSON.stringify(['CLOSE', this.subscriptionId]);
      this.ws.send(unsub);
      this.subscribe();
    }
  }

  // Force refresh - resubscribe to get new messages
  refresh() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      // Close current subscription and resubscribe
      const unsub = JSON.stringify(['CLOSE', this.subscriptionId]);
      this.ws.send(unsub);
      // Generate new subscription ID to get fresh data
      this.subscriptionId = `dm-${Math.random().toString(36).slice(2, 10)}`;
      this.subscribe();
    }
  }

  disconnect() {
    this.isDestroyed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null; // Prevent reconnect
      this.ws.close();
      this.ws = null;
    }
    this.seenEvents.clear();
  }
}

// NIP-04 encrypt for sending DMs
export const encryptNIP04 = async (
  content: string,
  privateKey: string,
  recipientPubkeyHex: string
): Promise<string | null> => {
  try {
    const privBytes = nsecToBytes(privateKey);
    const privHex = bytesToHex(privBytes);
    
    const sharedSecret = getSharedSecret(privHex, recipientPubkeyHex);
    
    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(16));
    
    const key = await crypto.subtle.importKey(
      'raw',
      sharedSecret.buffer as ArrayBuffer,
      { name: 'AES-CBC' },
      false,
      ['encrypt']
    );

    const encoded = new TextEncoder().encode(content);
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-CBC', iv: iv.buffer as ArrayBuffer },
      key,
      encoded.buffer as ArrayBuffer
    );

    const ciphertext = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
    const ivBase64 = btoa(String.fromCharCode(...iv));
    
    return `${ciphertext}?iv=${ivBase64}`;
  } catch (e) {
    console.error('NIP-04 encrypt error:', e);
    return null;
  }
};

// Get private key hex from nsec
export const nsecToHex = (nsec: string): string => {
  const bytes = nsecToBytes(nsec);
  return bytesToHex(bytes);
};

// Send encrypted DM
export const sendDM = async (
  senderKey: NostrKey,
  recipientPubkeyHex: string,
  content: string
): Promise<boolean> => {
  try {
    console.log('[SendDM] Starting...', { recipient: recipientPubkeyHex.slice(0, 16) + '...', contentLength: content.length });
    
    const encrypted = await encryptNIP04(content, senderKey.privateKey, recipientPubkeyHex);
    if (!encrypted) {
      console.error('[SendDM] Encryption failed');
      return false;
    }
    console.log('[SendDM] Encrypted successfully');

    const senderPrivBytes = nsecToBytes(senderKey.privateKey);
    const senderPrivHex = bytesToHex(senderPrivBytes);
    const pubkeyHex = npubToHex(senderKey.publicKey);

    const created_at = Math.floor(Date.now() / 1000);
    
    const event = {
      kind: 4,
      pubkey: pubkeyHex,
      created_at,
      tags: [['p', recipientPubkeyHex]],
      content: encrypted,
    };

    // Serialize for signing
    const serialized = JSON.stringify([
      0,
      event.pubkey,
      event.created_at,
      event.kind,
      event.tags,
      event.content,
    ]);

    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(serialized));
    const eventId = bytesToHex(new Uint8Array(hash));

    // Sign event (Nostr uses Schnorr/BIP340 signatures)
    const messageBytes = hexToBytes(eventId); // 32-byte sha256 hash
    const signPrivBytes = hexToBytes(senderPrivHex); // 32-byte secret key
    const sigBytes = await secp256k1.schnorr.signAsync(messageBytes, signPrivBytes);
    const sigHex = bytesToHex(sigBytes);

    const signedEvent = {
      ...event,
      id: eventId,
      sig: sigHex,
    };

    console.log('[SendDM] Event signed, sending to relays...');

    // Send to all relays
    const activeRelays = getActiveRelays();
    const sendPromises = activeRelays.map(async (url) => {
      try {
        const ws = new WebSocket(url);
        return new Promise<{ url: string; success: boolean; sent: boolean }>((resolve) => {
          let eventSent = false;
          
          const timeout = setTimeout(() => {
            console.log(`[SendDM] Timeout on ${url}`);
            ws.close();
            resolve({ url, success: false, sent: eventSent });
          }, 5000);

          ws.onopen = () => {
            console.log(`[SendDM] Connected to ${url}, sending event...`);
            ws.send(JSON.stringify(['EVENT', signedEvent]));
            eventSent = true;
          };

          ws.onmessage = (msg) => {
            try {
              const data = JSON.parse(msg.data);
              console.log(`[SendDM] Response from ${url}:`, data);
              if (data[0] === 'OK' && data[1] === eventId) {
                clearTimeout(timeout);
                ws.close();
                resolve({ url, success: data[2] === true, sent: true });
              }
            } catch {}
          };

          ws.onerror = (e) => {
            console.log(`[SendDM] Error on ${url}:`, e);
            clearTimeout(timeout);
            ws.close();
            resolve({ url, success: false, sent: eventSent });
          };
        });
      } catch {
        return { url, success: false, sent: false };
      }
    });

    const results = await Promise.all(sendPromises);
    const successCount = results.filter(r => r.success).length;
    const sentCount = results.filter(r => r.sent).length;
    console.log(`[SendDM] Results: ${successCount} confirmed, ${sentCount} sent out of ${results.length} relays`);
    
    // Consider success if at least one relay received the message
    return sentCount > 0;
  } catch (e) {
    console.error('[SendDM] Error:', e);
    return false;
  }
};

export class RelayPool {
  private connections: RelayConnection[] = [];
  private onDM: DMCallback;
  private keys: NostrKey[] = [];

  constructor(onDM: DMCallback) {
    this.onDM = onDM;
  }

  connect(keys: NostrKey[]) {
    this.keys = keys;
    
    if (keys.length === 0) {
      this.disconnect();
      return;
    }

    // Create connections if not exist
    if (this.connections.length === 0) {
      const activeRelays = getActiveRelays();
      this.connections = activeRelays.map(url => new RelayConnection(url, keys, this.onDM));
    } else {
      // Update keys on existing connections
      this.connections.forEach(conn => conn.updateKeys(keys));
    }

    // Connect all
    this.connections.forEach(conn => conn.connect());
  }

  // Force refresh all connections to get new messages
  refresh() {
    this.connections.forEach(conn => conn.refresh());
  }

  disconnect() {
    this.connections.forEach(conn => conn.disconnect());
    this.connections = [];
  }
}

export { getActiveRelays as getRelayList };
