import { useEffect, useRef, useCallback, useState } from 'react';
import { RelayPool, type NostrDM } from '@/lib/nostrRelay';
import type { NostrKey } from '@/lib/keyStore';

export const useNostrDMs = (keys: NostrKey[]) => {
  const [dms, setDMs] = useState<NostrDM[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const poolRef = useRef<RelayPool | null>(null);
  const seenIds = useRef(new Set<string>());

  const handleDM = useCallback((dm: NostrDM) => {
    if (seenIds.current.has(dm.id)) return;
    seenIds.current.add(dm.id);
    
    setDMs(prev => {
      // Insert sorted by timestamp (newest first)
      const updated = [...prev, dm].sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
      );
      // Limit to 100 DMs
      return updated.slice(0, 100);
    });
  }, []);

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

  const clearDMs = useCallback(() => {
    setDMs([]);
    seenIds.current.clear();
  }, []);

  return { dms, isConnected, clearDMs };
};
