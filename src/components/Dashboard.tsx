import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Check, ChevronDown, ChevronUp, Key, Shield, X, Loader2, Copy, ChevronLeft, ChevronRight } from 'lucide-react';
import logoN from '@/assets/logo-n.png';
import { KEY_COLORS } from '@/lib/keyStore';
import { useVault } from '@/context/VaultContext';
import { sendDM } from '@/lib/nostrRelay';
import { useLoginRequests } from '@/hooks/useLoginRequests';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import useEmblaCarousel from 'embla-carousel-react';

const EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const AUTO_RETURN_MS = 20 * 1000; // 20 seconds to auto-return to request key
const SELECTOR_AUTO_CLOSE_MS = 10 * 1000; // 10 seconds to auto-close selector
const MAX_VISIBLE_KEYS = 4; // Max keys visible without scrolling

interface KeySelectorDropdownProps {
  keys: Array<{ id: string; name: string; publicKey: string; color?: string }>;
  displayKey: { id: string; name: string; publicKey: string; color?: string } | null | undefined;
  onSelectKey: (id: string) => void;
  truncateKey: (key: string) => string;
}

const KeySelectorDropdown = ({ keys, displayKey, onSelectKey, truncateKey }: KeySelectorDropdownProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollUp(el.scrollTop > 0);
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 2);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScroll);
    return () => el.removeEventListener('scroll', checkScroll);
  }, [checkScroll, keys.length]);

  const scrollUp = () => {
    scrollRef.current?.scrollBy({ top: -72, behavior: 'smooth' });
  };

  const scrollDown = () => {
    scrollRef.current?.scrollBy({ top: 72, behavior: 'smooth' });
  };

  if (keys.length === 0) {
    return (
      <div className="absolute top-full left-0 right-0 mt-2 rounded-xl overflow-hidden z-50 neon-border bg-card/80 backdrop-blur-md">
        <div className="p-4 text-center text-muted-foreground">
          No keys added
        </div>
      </div>
    );
  }

  const showScrollIndicators = keys.length > MAX_VISIBLE_KEYS;

  return (
    <div className="absolute top-full left-0 right-0 mt-2 rounded-xl overflow-hidden z-50 neon-border bg-card/80 backdrop-blur-md">
      {/* Scroll up indicator */}
      {showScrollIndicators && (
        <button
          onClick={scrollUp}
          className={`w-full py-1.5 flex items-center justify-center transition-all ${
            canScrollUp ? 'opacity-100 hover:bg-primary/10' : 'opacity-30 cursor-default'
          }`}
          disabled={!canScrollUp}
        >
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        </button>
      )}

      {/* Keys list */}
      <div 
        ref={scrollRef}
        className="overflow-y-auto scrollbar-hide"
        style={{ maxHeight: `${MAX_VISIBLE_KEYS * 72}px` }}
      >
        {keys.map(key => (
          <button
            key={key.id}
            onClick={() => onSelectKey(key.id)}
            className={`w-full p-4 flex items-center gap-3 transition-colors hover:bg-primary/10 ${
              displayKey?.id === key.id ? 'bg-primary/20' : ''
            }`}
            style={{ height: '72px' }}
          >
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{ 
                backgroundColor: `${key.color || KEY_COLORS[0].value}20`,
                boxShadow: `0 0 10px ${key.color || KEY_COLORS[0].value}, 0 0 20px ${key.color || KEY_COLORS[0].value}50`
              }}
            >
              <Key className="w-4 h-4" style={{ color: key.color || KEY_COLORS[0].value }} />
            </div>
            <div className="flex-1 text-left min-w-0">
              <span className="font-medium text-foreground block truncate">{key.name}</span>
              <span className="text-xs text-muted-foreground block font-mono truncate">
                {truncateKey(key.publicKey)}
              </span>
            </div>
            {displayKey?.id === key.id && (
              <Check className="w-4 h-4 text-primary shrink-0" />
            )}
          </button>
        ))}
      </div>

      {/* Scroll down indicator */}
      {showScrollIndicators && (
        <button
          onClick={scrollDown}
          className={`w-full py-1.5 flex items-center justify-center transition-all ${
            canScrollDown ? 'opacity-100 hover:bg-primary/10' : 'opacity-30 cursor-default'
          }`}
          disabled={!canScrollDown}
        >
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </button>
      )}
    </div>
  );
};

const Dashboard = () => {
  const { keys, logs, defaultKeyId, setDefaultKey, addLog } = useVault();
  const { loginRequests, isConnected, removeRequest } = useLoginRequests(keys, logs);
  const [showSelector, setShowSelector] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [manualKeyOverride, setManualKeyOverride] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const selectorRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside or after 10 seconds
  useEffect(() => {
    if (!showSelector) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
        setShowSelector(false);
      }
    };
    
    // Auto-close after 10 seconds
    const autoCloseTimer = setTimeout(() => {
      setShowSelector(false);
    }, SELECTOR_AUTO_CLOSE_MS);
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      clearTimeout(autoCloseTimer);
    };
  }, [showSelector]);

  // Embla carousel
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: false,
    align: 'center',
    containScroll: 'trimSnaps'
  });

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  // Update current index when carousel scrolls
  useEffect(() => {
    if (!emblaApi) return;
    
    const onSelect = () => {
      setCurrentIndex(emblaApi.selectedScrollSnap());
    };
    
    emblaApi.on('select', onSelect);
    onSelect();
    
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi]);

  // Auto-return to request key after 20 seconds
  useEffect(() => {
    if (!manualKeyOverride || loginRequests.length === 0) return;

    const timer = setTimeout(() => {
      setManualKeyOverride(null);
    }, AUTO_RETURN_MS);

    return () => clearTimeout(timer);
  }, [manualKeyOverride, loginRequests.length]);

  // Auto-expire requests older than 5 minutes
  useEffect(() => {
    const checkExpiry = async () => {
      const now = Date.now();
      for (const request of loginRequests) {
        const age = now - request.timestamp.getTime();
        if (age > EXPIRY_MS) {
          await addLog({
            id: crypto.randomUUID(),
            keyId: request.keyId,
            keyName: request.keyName,
            action: 'Expired',
            app: request.siteName,
            timestamp: new Date(),
          });
          removeRequest(request.id);
        }
      }
    };

    checkExpiry();
    const interval = setInterval(checkExpiry, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginRequests.length]);

  // Memoize keys lookup map for O(1) access
  const keysMap = useMemo(() => {
    const map = new Map<string, typeof keys[0]>();
    keys.forEach(k => map.set(k.id, k));
    return map;
  }, [keys]);

  // Get current request based on carousel index
  const currentRequest = loginRequests.length > 0 ? loginRequests[currentIndex] || loginRequests[0] : null;

  // Priority for display key (using memoized map for O(1) lookup):
  // 1. If user manually overrode during active request, use that (temporary)
  // 2. If there's a login request, use that key
  // 3. If user manually selected a key (persists until lock), use it
  // 4. If user has set a default key, use it
  // 5. Otherwise, use the first key
  const displayKey = useMemo(() => {
    if (manualKeyOverride) return keysMap.get(manualKeyOverride);
    if (currentRequest) return keysMap.get(currentRequest.keyId);
    if (selectedKeyId) return keysMap.get(selectedKeyId);
    if (defaultKeyId) return keysMap.get(defaultKeyId);
    return keys.length > 0 ? keys[0] : null;
  }, [manualKeyOverride, currentRequest, selectedKeyId, defaultKeyId, keysMap, keys]);

  // Check if we're showing a different key than the request key
  const isOverriding = manualKeyOverride && currentRequest && manualKeyOverride !== currentRequest.keyId;

  const handleSelectKey = (id: string) => {
    // If there are active requests, set as temporary override
    if (loginRequests.length > 0) {
      setManualKeyOverride(id);
    }
    // Always set as selected key (persists until lock, overrides default)
    setSelectedKeyId(id);
    setShowSelector(false);
  };

  const handleCopyKey = (pubkey: string) => {
    navigator.clipboard.writeText(pubkey);
    toast.success('Key copied to clipboard');
  };

  const handleAccept = async (request: typeof loginRequests[0]) => {
    const key = keys.find(k => k.id === request.keyId);
    if (!key) return;

    setProcessingId(request.id);
    try {
      const success = await sendDM(key, request.senderPubkey, request.responseContent);
      if (success) {
        await addLog({
          id: crypto.randomUUID(),
          keyId: request.keyId,
          keyName: request.keyName,
          action: 'Accepted',
          app: request.siteName,
          timestamp: new Date(),
          challengeCode: request.challengeCode,
        });
        removeRequest(request.id);
        toast.success('Response sent');
      } else {
        toast.error('Failed to send (no relay confirmed)');
      }
    } catch (e) {
      console.error('Failed to send response:', e);
      toast.error('Error sending response');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeny = async (request: typeof loginRequests[0]) => {
    await addLog({
      id: crypto.randomUUID(),
      keyId: request.keyId,
      keyName: request.keyName,
      action: 'Denied',
      app: request.siteName,
      timestamp: new Date(),
      challengeCode: request.challengeCode,
    });
    removeRequest(request.id);
  };

  const truncateKey = useCallback((key: string) => {
    if (key.length > 16) {
      return key.slice(0, 8) + '...' + key.slice(-8);
    }
    return key;
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header */}
      <div className="shrink-0 bg-background/80 backdrop-blur-sm p-4 pb-0 z-10">
        <div className="flex items-center gap-3 mb-4">
          <img src={logoN} alt="Logo" className="w-10 h-10 rounded-full neon-glow" />
          <h1 className="text-xl font-bold text-foreground">
            Nostr <span className="text-primary">Authenticator</span>
          </h1>
        </div>
      </div>
      
      {/* Scrollable Content */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-4 pb-4">

      {/* Key Selector - always visible */}
      <div className="relative mb-6" ref={selectorRef}>
        <button
          onClick={() => setShowSelector(!showSelector)}
          className="w-full glass-card rounded-xl p-4 flex items-center gap-3 neon-border transition-all hover:bg-card/80"
        >
          <div 
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ 
              backgroundColor: `${displayKey?.color || KEY_COLORS[0].value}20`,
              boxShadow: `0 0 20px ${displayKey?.color || KEY_COLORS[0].value}40, 0 0 40px ${displayKey?.color || KEY_COLORS[0].value}20`
            }}
          >
            <Key className="w-7 h-7" style={{ color: displayKey?.color || KEY_COLORS[0].value }} />
          </div>
          <div className="flex-1 text-left">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">
                {displayKey?.name || 'Select a key'}
              </span>
              {displayKey && <Check className="w-4 h-4" style={{ color: 'hsl(160, 100%, 50%)' }} />}
              {loginRequests.length > 0 && (
                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                  {loginRequests.length} request{loginRequests.length > 1 ? 's' : ''}
                </span>
              )}
              {isOverriding && (
                <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full">
                  20s
                </span>
              )}
            </div>
            {displayKey && (
              <span 
                className="text-sm text-muted-foreground font-mono cursor-pointer hover:text-primary transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyKey(displayKey.publicKey);
                }}
              >
                #{truncateKey(displayKey.publicKey)}
                <Copy className="w-3 h-3 inline ml-1" />
              </span>
            )}
          </div>
          <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${showSelector ? 'rotate-180' : 'rotate-0'}`} />
        </button>

        {showSelector && (
          <KeySelectorDropdown 
            keys={keys}
            displayKey={displayKey}
            onSelectKey={handleSelectKey}
            truncateKey={truncateKey}
          />
        )}
      </div>

      {/* Connection status */}
      <div className="flex items-center gap-1.5 mb-4">
        <div 
          className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-muted/50'}`}
          style={isConnected ? {
            boxShadow: '0 0 6px rgba(34, 197, 94, 0.5), 0 0 12px rgba(34, 197, 94, 0.3)'
          } : undefined}
        />
        <span 
          className="text-xs text-foreground/80"
          style={isConnected ? {
            textShadow: '0 0 4px hsl(var(--primary) / 0.1)'
          } : undefined}
        >
          {isConnected ? 'Authorization Requests:' : 'Disconnected'}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {keys.length === 0 ? (
          <div className="text-center py-12">
            <Key className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">Add a key to get started</p>
          </div>
        ) : loginRequests.length === 0 ? (
          <div className="text-center py-12">
            <Shield className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">No Authorization Requests</p>
            <p className="text-xs text-muted-foreground mt-2">Checking every second</p>
          </div>
        ) : (
          <div className="relative">
            {/* Carousel navigation - only show if multiple requests */}
            {loginRequests.length > 1 && (
              <>
                <button
                  onClick={scrollPrev}
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full glass-card flex items-center justify-center hover:bg-card/80 transition-colors"
                  disabled={currentIndex === 0}
                >
                  <ChevronLeft className="w-5 h-5 text-foreground" />
                </button>
                <button
                  onClick={scrollNext}
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full glass-card flex items-center justify-center hover:bg-card/80 transition-colors"
                  disabled={currentIndex === loginRequests.length - 1}
                >
                  <ChevronRight className="w-5 h-5 text-foreground" />
                </button>
              </>
            )}

            {/* Carousel */}
            <div 
              className="overflow-hidden" 
              ref={emblaRef}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
            >
              <div className="flex">
                {loginRequests.map((request, index) => {
                  const requestKey = keysMap.get(request.keyId);
                  const keyColor = requestKey?.color || KEY_COLORS[0].value;
                  
                  return (
                  <div 
                    key={request.id} 
                    className="flex-[0_0_100%] min-w-0 px-2"
                  >
                    <div className="glass-card rounded-xl p-4 neon-border">
                      {/* Key badge for this request */}
                      <div className="flex items-center gap-2 mb-3">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ 
                            backgroundColor: `${keyColor}20`,
                            boxShadow: `0 0 10px ${keyColor}, 0 0 20px ${keyColor}50`
                          }}
                        >
                          <Key className="w-4 h-4" style={{ color: keyColor }} />
                        </div>
                        <div className="flex-1">
                          <span className="font-medium text-foreground text-sm">
                            {request.keyName}
                          </span>
                          <span className="text-xs text-muted-foreground block font-mono">
                            {truncateKey(requestKey?.publicKey || '')}
                          </span>
                        </div>
                      </div>

                      {/* Site name */}
                      <div className="flex items-center gap-2 mb-3">
                        <Shield className="w-5 h-5 text-primary" />
                        <span className="font-semibold text-foreground">{request.siteName}</span>
                      </div>

                      {/* Response content */}
                      <div className="bg-background/50 rounded-lg p-3 mb-4 font-mono text-sm max-h-24 overflow-auto scrollbar-hide">
                        <p className="text-primary break-all whitespace-pre-wrap">{request.responseContent}</p>
                      </div>

                      <p className="text-xs text-muted-foreground mb-4">
                        Primit: {request.timestamp.toLocaleTimeString()} • {request.relay.replace('wss://', '').replace('/', '')}
                      </p>

                      {/* Buttons */}
                      <div className="flex gap-3">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => handleDeny(request)}
                          disabled={processingId === request.id}
                        >
                          <X className="w-4 h-4 mr-2" />
                          Deny
                        </Button>
                        <Button
                          className="flex-1"
                          onClick={() => handleAccept(request)}
                          disabled={processingId === request.id}
                        >
                          {processingId === request.id ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4 mr-2" />
                          )}
                          Accept
                        </Button>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>

            {/* Dots indicator */}
            {loginRequests.length > 1 && (
              <div className="flex justify-center gap-2 mt-4">
                {loginRequests.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => emblaApi?.scrollTo(index)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      index === currentIndex 
                        ? 'bg-primary w-4' 
                        : 'bg-muted-foreground/30'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

export default Dashboard;