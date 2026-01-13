import { useState } from 'react';
import { Trash2, Settings, Shield, History, Radio, User } from 'lucide-react';
import { APP_VERSION } from '@/lib/constants';
import { useVault } from '@/context/VaultContext';
import RelayManager from '@/components/RelayManager';
import AdminManager from '@/components/AdminManager';
import SecuritySheet from '@/components/SecuritySheet';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface SettingsScreenProps {
  onLogout: () => void;
  onEnablePin: () => void;
}

const SettingsScreen = ({ onLogout, onEnablePin }: SettingsScreenProps) => {
  const { resetVault, pinEnabled, clearLogs, logs } = useVault();
  const [showClearHistoryDialog, setShowClearHistoryDialog] = useState(false);
  const [showClearDataDialog, setShowClearDataDialog] = useState(false);
  const [showRelayManager, setShowRelayManager] = useState(false);
  const [showAdminManager, setShowAdminManager] = useState(false);
  const [showSecuritySheet, setShowSecuritySheet] = useState(false);

  const handleClearHistory = async () => {
    await clearLogs();
    setShowClearHistoryDialog(false);
    toast.success('History cleared');
  };

  const handleClearData = () => {
    resetVault();
    setShowClearDataDialog(false);
    toast.success('All data deleted');
    window.location.reload();
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Fixed Header */}
      <div className="shrink-0 bg-background/80 backdrop-blur-sm p-4 pb-2 z-10">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary" />
          Settings
        </h2>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-4 pb-4">
        <div className="space-y-3">
          {/* Security */}
          <button
            onClick={() => setShowSecuritySheet(true)}
            className="w-full glass-card rounded-xl p-4 neon-border flex items-center gap-3 transition-all hover:bg-card/80"
          >
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-medium text-foreground">Security</p>
              <p className="text-xs text-muted-foreground">
                {pinEnabled ? 'PIN enabled • Encrypted' : 'PIN disabled • Unencrypted'}
              </p>
            </div>
          </button>

          {/* Relay Manager */}
          <button
            onClick={() => setShowRelayManager(true)}
            className="w-full glass-card rounded-xl p-4 neon-border flex items-center gap-3 transition-all hover:bg-card/80"
          >
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Radio className="w-5 h-5 text-blue-500" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-medium text-foreground">Manage Relays</p>
              <p className="text-xs text-muted-foreground">Add, remove, or view relay status</p>
            </div>
          </button>

          {/* Admin Account */}
          <button
            onClick={() => setShowAdminManager(true)}
            className="w-full glass-card rounded-xl p-4 neon-border flex items-center gap-3 transition-all hover:bg-card/80"
          >
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
              <User className="w-5 h-5 text-purple-500" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-medium text-foreground">Admin Account</p>
              <p className="text-xs text-muted-foreground">Configure auth request sender</p>
            </div>
          </button>

          {/* Clear History */}
          <button
            onClick={() => setShowClearHistoryDialog(true)}
            disabled={logs.length === 0}
            className="w-full glass-card rounded-xl p-4 neon-border flex items-center gap-3 transition-all hover:bg-card/80 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
              <History className="w-5 h-5 text-purple-500" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-medium text-foreground">Clear History</p>
              <p className="text-xs text-muted-foreground">
                {logs.length > 0 ? `${logs.length} entries` : 'No entries'}
              </p>
            </div>
          </button>

          {/* Clear Data */}
          <button
            onClick={() => setShowClearDataDialog(true)}
            className="w-full glass-card rounded-xl p-4 border border-destructive/30 flex items-center gap-3 transition-all hover:bg-destructive/10"
          >
            <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-destructive" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-medium text-destructive">Delete All Data</p>
              <p className="text-xs text-muted-foreground">Completely reset the app</p>
            </div>
          </button>
        </div>

        {/* App Info */}
        <div className="mt-auto pt-4 pb-2">
          <div className="text-right opacity-40">
            <p className="text-xs text-muted-foreground">Nostr Authenticator v{APP_VERSION}</p>
            <p className="text-xs text-muted-foreground">{pinEnabled ? 'Encrypted' : 'Unencrypted'} Storage</p>
            <a 
              href="https://botrift.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              by botrift.com
            </a>
          </div>
        </div>
      </div>

      {/* Clear History Dialog */}
      <AlertDialog open={showClearHistoryDialog} onOpenChange={setShowClearHistoryDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear History</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all authorization history entries. 
              You will no longer be able to see which sites you have accepted or denied access to.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearHistory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Clear History
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear Data Dialog */}
      <AlertDialog open={showClearDataDialog} onOpenChange={setShowClearDataDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete All Data</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                <strong className="text-destructive">⚠️ Warning:</strong> This will permanently delete ALL your data including:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>All your Nostr keys (public and private)</li>
                <li>All authorization history</li>
                <li>PIN settings and preferences</li>
              </ul>
              <p className="font-semibold">
                Your keys cannot be recovered after deletion! Make sure you have backed up your private keys (nsec) before proceeding.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearData} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Security Sheet */}
      <SecuritySheet 
        open={showSecuritySheet}
        onOpenChange={setShowSecuritySheet}
        onEnablePin={onEnablePin}
        onLock={onLogout}
      />

      {/* Relay Manager Modal */}
      {showRelayManager && (
        <RelayManager onClose={() => setShowRelayManager(false)} />
      )}

      {/* Admin Manager Modal */}
      {showAdminManager && (
        <AdminManager onClose={() => setShowAdminManager(false)} />
      )}
    </div>
  );
};

export default SettingsScreen;
