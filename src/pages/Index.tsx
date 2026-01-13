import { useState, useRef, useEffect, useCallback, TouchEvent } from 'react';
import { useVault } from '@/context/VaultContext';
import PinScreen from '@/components/PinScreen';
import Dashboard from '@/components/Dashboard';
import KeysScreen from '@/components/KeysScreen';
import HistoryScreen from '@/components/HistoryScreen';
import SettingsScreen from '@/components/SettingsScreen';
import BottomNav from '@/components/BottomNav';
import background from '@/assets/background.png';

type Tab = 'dashboard' | 'keys' | 'history' | 'settings';

const TABS: Tab[] = ['dashboard', 'keys', 'history', 'settings'];
const SWIPE_THRESHOLD = 50;
const INACTIVITY_TIMEOUT_MS = 30 * 1000; // 30 seconds

const Index = () => {
  const { pinEnabled, isSetup, isUnlocked, lock } = useVault();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  // Reset to dashboard on app visibility change (return to app)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setActiveTab('dashboard');
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  const touchStartX = useRef<number>(0);
  const touchCurrentX = useRef<number>(0);
  const inactivityTimer = useRef<NodeJS.Timeout | null>(null);

  // Reset inactivity timer on any user interaction
  const resetInactivityTimer = useCallback(() => {
    if (!pinEnabled) return; // Only timeout if PIN is enabled
    
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }
    
    inactivityTimer.current = setTimeout(() => {
      lock();
    }, INACTIVITY_TIMEOUT_MS);
  }, [pinEnabled, lock]);

  // Set up activity listeners
  useEffect(() => {
    if (!pinEnabled || !isUnlocked) return;

    const events = ['touchstart', 'mousedown', 'keydown', 'scroll'];
    
    events.forEach(event => {
      window.addEventListener(event, resetInactivityTimer, { passive: true });
    });

    // Start initial timer
    resetInactivityTimer();

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, resetInactivityTimer);
      });
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
      }
    };
  }, [pinEnabled, isUnlocked, resetInactivityTimer]);

  const handleTouchStart = (e: TouchEvent) => {
    if (isTransitioning) return;
    touchStartX.current = e.touches[0].clientX;
    touchCurrentX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (isTransitioning) return;
    touchCurrentX.current = e.touches[0].clientX;
    const diff = touchCurrentX.current - touchStartX.current;
    
    // Limit swipe to prevent going past edges
    const currentIndex = TABS.indexOf(activeTab);
    if ((currentIndex === 0 && diff > 0) || (currentIndex === TABS.length - 1 && diff < 0)) {
      setSwipeOffset(diff * 0.2); // Reduced resistance at edges
    } else {
      setSwipeOffset(diff);
    }
  };

  const handleTouchEnd = () => {
    if (isTransitioning) return;
    
    const diff = touchCurrentX.current - touchStartX.current;
    const currentIndex = TABS.indexOf(activeTab);
    
    if (Math.abs(diff) > SWIPE_THRESHOLD) {
      if (diff > 0 && currentIndex > 0) {
        // Swipe right - go to previous tab
        setIsTransitioning(true);
        setActiveTab(TABS[currentIndex - 1]);
      } else if (diff < 0 && currentIndex < TABS.length - 1) {
        // Swipe left - go to next tab
        setIsTransitioning(true);
        setActiveTab(TABS[currentIndex + 1]);
      }
    }
    
    setSwipeOffset(0);
    setTimeout(() => setIsTransitioning(false), 300);
  };

  // Show PIN screen if PIN is enabled and vault not unlocked
  if (pinEnabled && !isUnlocked) {
    return (
      <div className="min-h-screen relative">
        <div
          className="fixed inset-0 bg-cover bg-center opacity-20 pointer-events-none"
          style={{ backgroundImage: `url(${background})` }}
        />
        <PinScreen isSetup={!isSetup} onCancel={undefined} />
      </div>
    );
  }

  // Show PIN setup screen when enabling PIN from settings
  if (showPinSetup) {
    return (
      <div className="min-h-screen relative">
        <div
          className="fixed inset-0 bg-cover bg-center opacity-20 pointer-events-none"
          style={{ backgroundImage: `url(${background})` }}
        />
        <PinScreen 
          isSetup={true} 
          onCancel={() => setShowPinSetup(false)} 
          onSuccess={() => setShowPinSetup(false)}
        />
      </div>
    );
  }

  const currentIndex = TABS.indexOf(activeTab);

  return (
    <div className="h-screen flex flex-col bg-background relative overflow-hidden">
      {/* Background */}
      <div
        className="fixed inset-0 bg-cover bg-center opacity-10 pointer-events-none"
        style={{ backgroundImage: `url(${background})` }}
      />

      {/* Gradient overlay */}
      <div className="fixed inset-0 bg-gradient-to-b from-background/50 via-background/80 to-background pointer-events-none" />

      {/* Scan lines effect */}
      <div className="fixed inset-0 opacity-[0.02] pointer-events-none">
        <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,hsl(var(--primary)/0.1)_2px,hsl(var(--primary)/0.1)_4px)]" />
      </div>

      {/* Main content - swipeable screens */}
      <main 
        className="h-0 flex-1 relative z-10 max-w-md mx-auto w-full overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div 
          className="flex h-full transition-transform duration-300 ease-out"
          style={{ 
            width: '400%',
            transform: `translateX(calc(-${currentIndex * 25}% + ${swipeOffset}px))`,
          }}
        >
          <div className="h-full pb-20" style={{ width: '25%' }}>
            <Dashboard />
          </div>
          <div className="h-full pb-20" style={{ width: '25%' }}>
            <KeysScreen />
          </div>
          <div className="h-full pb-20" style={{ width: '25%' }}>
            <HistoryScreen />
          </div>
          <div className="h-full pb-20" style={{ width: '25%' }}>
            <SettingsScreen 
              onLogout={lock} 
              onEnablePin={() => setShowPinSetup(true)} 
            />
          </div>
        </div>
      </main>

      {/* Fixed bottom navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-20 max-w-md mx-auto w-full">
        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    </div>
  );
};

export default Index;
