import { Shield, Key, History, Settings } from 'lucide-react';

type Tab = 'dashboard' | 'keys' | 'history' | 'settings';

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const BottomNav = ({ activeTab, onTabChange }: BottomNavProps) => {
  const tabs: { id: Tab; icon: typeof Shield; label: string }[] = [
    { id: 'dashboard', icon: Shield, label: 'AUTH' },
    { id: 'keys', icon: Key, label: 'KEYS' },
    { id: 'history', icon: History, label: 'HISTORY' },
    { id: 'settings', icon: Settings, label: 'SETTINGS' },
  ];

  return (
    <nav className="glass-card border-t border-border/50 px-4 py-2 safe-area-bottom">
      <div className="flex items-center justify-around">
        {tabs.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={`flex flex-col items-center gap-1 py-2 px-4 rounded-xl transition-all ${
              activeTab === id
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className={`relative ${activeTab === id ? 'neon-glow rounded-lg p-1' : ''}`}>
              <Icon className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;
