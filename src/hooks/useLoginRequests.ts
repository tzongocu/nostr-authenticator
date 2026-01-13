import { useEffect, useRef, useCallback, useState } from 'react';
import { RelayPool, npubToHex, type NostrDM } from '@/lib/nostrRelay';
import type { NostrKey, SignLog } from '@/lib/keyStore';
import { getAdminNpub } from '@/lib/adminStore';

export interface LoginRequest {
  id: string;
  keyId: string;
  keyName: string;
  challengeCode: string;
  responseContent: string;
  siteName: string;
  timestamp: Date;
  relay: string;
  senderPubkey: string;
}

const EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const MAX_SEEN_IDS = 500; // Limit memory usage

// Extract clean domain from content
const extractDomain = (content: string): string | null => {
  // Match domain pattern like "it.botrift.com", "example.org", etc.
  const domainMatch = content.match(/\b([a-z0-9][-a-z0-9]*\.)+[a-z]{2,}\b/gi);
  if (domainMatch && domainMatch.length > 0) {
    // Return first valid domain found (not relay domains)
    for (const domain of domainMatch) {
      const lower = domain.toLowerCase();
      // Skip relay domains
      if (lower.includes('relay') || lower.includes('nostr') || lower.includes('wss')) continue;
      return domain;
    }
    // If all are relay domains, return first one anyway
    return domainMatch[0];
  }
  return null;
};

// Parse login request format
const parseLoginRequest = (content: string): { challengeCode: string; responseContent: string; siteName: string } | null => {
  console.log('[parseLoginRequest] Raw content:', content);
  
  // New format: "Authorize session:\nChallenge code:\nXXX"
  if (content.includes('Authorize session:') && content.includes('Challenge code:')) {
    const match = content.match(/Authorize session:\s*\n\s*Challenge code:\s*\n\s*([a-zA-Z0-9-]+)/i);
    
    if (!match) return null;
    
    const challengeCode = match[1];
    const responseContent = `Authorize session:\nChallenge code:\n${challengeCode}`;

    // Priority: extract domain from content first
    const domain = extractDomain(content);
    const siteName = domain || 'Botrift';

    console.log('[parseLoginRequest] Extracted siteName:', siteName);

    return { challengeCode, responseContent, siteName };
  }

  // Old format: "🔐 Botrift Admin Login..."
  if (content.includes('🔐 Botrift') && content.includes('Challenge code:')) {
    const codeMatch = content.match(/Challenge code:\s*([a-zA-Z0-9-]+)/);
    if (!codeMatch) return null;

    const challengeCode = codeMatch[1];
    
    // Priority: extract domain from content first
    const domain = extractDomain(content);
    const siteName = domain || 'Botrift';

    console.log('[parseLoginRequest] Old format siteName:', siteName);

    const oldFormatMatch = content.match(/(🔐 Botrift Admin Login[\s\S]*?Challenge code:\s*[a-zA-Z0-9-]+)/);
    
    return {
      challengeCode,
      responseContent: oldFormatMatch ? oldFormatMatch[1].trim() : content.trim(),
      siteName
    };
  }

  return null;
};

export const useLoginRequests = (keys: NostrKey[], logs: SignLog[]) => {
  const [loginRequests, setLoginRequests] = useState<LoginRequest[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const poolRef = useRef<RelayPool | null>(null);
  const seenIds = useRef(new Set<string>());
  const seenChallenges = useRef(new Set<string>()); // Dedupe by challenge code
  const processedChallenges = useRef(new Set<string>()); // Permanently processed (accepted/denied)
  
  // Get admin hex from store (converted from npub)
  const adminHex = npubToHex(getAdminNpub());

  // Build set of challenge codes from history logs
  const historyChallenges = useRef(new Set<string>());
  useEffect(() => {
    const codes = new Set<string>();
    for (const log of logs) {
      if (log.challengeCode) {
        codes.add(log.challengeCode);
      }
    }
    historyChallenges.current = codes;
  }, [logs]);

  const handleDM = useCallback((dm: NostrDM) => {
    // Only process messages from configured Admin
    if (dm.senderPubkey !== adminHex) return;

    // Skip if already seen this event id
    if (seenIds.current.has(dm.id)) return;
    seenIds.current.add(dm.id);
    
    // Limit seenIds size to prevent memory leak
    if (seenIds.current.size > MAX_SEEN_IDS) {
      const arr = Array.from(seenIds.current);
      seenIds.current = new Set(arr.slice(-MAX_SEEN_IDS / 2));
    }

    // Check if message matches login format
    if (!dm.decryptedContent) return;
    
    const parsed = parseLoginRequest(dm.decryptedContent);
    if (!parsed) return;

    // Skip if this challenge exists in history (already processed before)
    if (historyChallenges.current.has(parsed.challengeCode)) return;

    // Skip if this challenge was already processed in this session (accepted/denied)
    if (processedChallenges.current.has(parsed.challengeCode)) return;

    // Skip if we already have a request with this challenge code (same request from different relay)
    if (seenChallenges.current.has(parsed.challengeCode)) return;

    // Skip if message is already expired (older than 5 minutes) - prevents flickering
    const age = Date.now() - dm.timestamp.getTime();
    if (age > EXPIRY_MS) return;

    seenChallenges.current.add(parsed.challengeCode);

    const loginRequest: LoginRequest = {
      id: dm.id,
      keyId: dm.keyId,
      keyName: dm.keyName,
      challengeCode: parsed.challengeCode,
      responseContent: parsed.responseContent,
      siteName: parsed.siteName,
      timestamp: dm.timestamp,
      relay: dm.relay,
      senderPubkey: dm.senderPubkey,
    };

    setLoginRequests(prev => {
      // Double-check: skip if already exists by id or challengeCode
      if (prev.some(r => r.id === loginRequest.id || r.challengeCode === loginRequest.challengeCode)) {
        return prev;
      }
      
      // Add and sort by timestamp (newest first)
      const updated = [...prev, loginRequest].sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
      );
      return updated;
    });
  }, [adminHex]);

  useEffect(() => {
    if (!poolRef.current) {
      poolRef.current = new RelayPool(handleDM);
    }

    if (keys.length > 0) {
      poolRef.current.connect(keys);
      setIsConnected(true);
    } else {
      poolRef.current.disconnect();
      setIsConnected(false);
    }

    return () => {
      poolRef.current?.disconnect();
    };
  }, [keys, handleDM]);

  // Polling every 10 seconds when visible, pause when hidden for battery savings
  useEffect(() => {
    if (keys.length === 0) return;
    
    let interval: ReturnType<typeof setInterval> | null = null;
    
    const startPolling = () => {
      if (interval) clearInterval(interval);
      interval = setInterval(() => {
        poolRef.current?.refresh();
      }, 10000); // Increased to 10s for battery efficiency
    };
    
    const stopPolling = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };
    
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        poolRef.current?.refresh(); // Immediate refresh on return
        startPolling();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    startPolling();

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [keys.length]);

  const removeRequest = useCallback((id: string) => {
    setLoginRequests(prev => {
      const request = prev.find(r => r.id === id);
      if (request) {
        // Mark this challenge as permanently processed - will never reappear
        processedChallenges.current.add(request.challengeCode);
      }
      return prev.filter(r => r.id !== id);
    });
  }, []);

  return { loginRequests, isConnected, removeRequest };
};
