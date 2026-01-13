import { useState, useEffect } from 'react';
import { Radio, Plus, Trash2, RotateCcw, X, Check, Loader2 } from 'lucide-react';
import { getRelays, addRelay, removeRelay, resetRelays, DEFAULT_RELAYS } from '@/lib/relayStore';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import Portal from './Portal';
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

interface RelayStatus {
  url: string;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
}

interface RelayManagerProps {
  onClose: () => void;
}

const RelayManager = ({ onClose }: RelayManagerProps) => {
  const [relays, setRelays] = useState<string[]>([]);
  const [relayStatuses, setRelayStatuses] = useState<Map<string, RelayStatus['status']>>(new Map());
  const [newRelayUrl, setNewRelayUrl] = useState('');
  const [showAddInput, setShowAddInput] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);

  useEffect(() => {
    setRelays(getRelays());
  }, []);

  // Check connection status for each relay
  useEffect(() => {
    const checkRelayStatus = async (url: string) => {
      setRelayStatuses(prev => new Map(prev).set(url, 'connecting'));
      
      try {
        const ws = new WebSocket(url);
        
        const timeout = setTimeout(() => {
          ws.close();
          setRelayStatuses(prev => new Map(prev).set(url, 'error'));
        }, 5000);

        ws.onopen = () => {
          clearTimeout(timeout);
          setRelayStatuses(prev => new Map(prev).set(url, 'connected'));
          ws.close();
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          setRelayStatuses(prev => new Map(prev).set(url, 'error'));
        };
      } catch {
        setRelayStatuses(prev => new Map(prev).set(url, 'error'));
      }
    };

    relays.forEach(url => {
      checkRelayStatus(url);
    });
  }, [relays]);

  const handleAddRelay = () => {
    if (!newRelayUrl.trim()) return;
    
    const updated = addRelay(newRelayUrl);
    setRelays(updated);
    setNewRelayUrl('');
    setShowAddInput(false);
    toast.success('Relay added');
  };

  const handleRemoveRelay = (url: string) => {
    const updated = removeRelay(url);
    setRelays(updated);
    setShowDeleteDialog(null);
    toast.success('Relay removed');
  };

  const handleReset = () => {
    const updated = resetRelays();
    setRelays(updated);
    setShowResetDialog(false);
    toast.success('Relays reset to default');
  };

  const getStatusColor = (status: RelayStatus['status'] | undefined) => {
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500 animate-pulse';
      case 'error': return 'bg-destructive';
      default: return 'bg-muted';
    }
  };

  const getStatusText = (status: RelayStatus['status'] | undefined) => {
    switch (status) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Checking...';
      case 'error': return 'Offline';
      default: return 'Unknown';
    }
  };

  const connectedCount = Array.from(relayStatuses.values()).filter(s => s === 'connected').length;

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md glass-card rounded-xl neon-border overflow-hidden max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Relay Manager</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Stats */}
        <div className="px-4 py-3 bg-primary/5 border-b border-border">
          <p className="text-sm text-muted-foreground">
            <span className="text-primary font-medium">{connectedCount}</span> of {relays.length} relays connected
          </p>
        </div>

        {/* Relay List */}
        <div className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-2">
          {relays.map((url) => (
            <div 
              key={url}
              className="flex items-center gap-3 p-3 rounded-lg bg-card/50 border border-border/50"
            >
              {/* Status indicator */}
              <div className={`w-2 h-2 rounded-full shrink-0 ${getStatusColor(relayStatuses.get(url))}`} />
              
              {/* URL */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground font-mono truncate">
                  {url.replace('wss://', '').replace('/', '')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {getStatusText(relayStatuses.get(url))}
                </p>
              </div>

              {/* Delete button */}
              <button
                onClick={() => setShowDeleteDialog(url)}
                className="p-2 rounded-full hover:bg-destructive/20 transition-colors"
              >
                <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          ))}

          {/* Add new relay input */}
          {showAddInput ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-card/50 border border-primary/30">
              <input
                type="text"
                value={newRelayUrl}
                onChange={(e) => setNewRelayUrl(e.target.value)}
                placeholder="wss://relay.example.com"
                className="flex-1 bg-transparent text-sm text-foreground font-mono focus:outline-none"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddRelay();
                  if (e.key === 'Escape') {
                    setShowAddInput(false);
                    setNewRelayUrl('');
                  }
                }}
              />
              <button
                onClick={handleAddRelay}
                disabled={!newRelayUrl.trim()}
                className="p-2 rounded-full bg-primary/20 hover:bg-primary/30 transition-colors disabled:opacity-50"
              >
                <Check className="w-4 h-4 text-primary" />
              </button>
              <button
                onClick={() => {
                  setShowAddInput(false);
                  setNewRelayUrl('');
                }}
                className="p-2 rounded-full hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddInput(true)}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-colors"
            >
              <Plus className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Add Relay</span>
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowResetDialog(true)}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset to Default
          </Button>
        </div>
      </div>

      {/* Reset Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Relays</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace your current relay list with the default {DEFAULT_RELAYS.length} relays.
              Any custom relays you added will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset}>
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!showDeleteDialog} onOpenChange={() => setShowDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Relay</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this relay?
              <br />
              <code className="text-xs bg-muted px-2 py-1 rounded mt-2 block">
                {showDeleteDialog?.replace('wss://', '').replace('/', '')}
              </code>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => showDeleteDialog && handleRemoveRelay(showDeleteDialog)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </Portal>
  );
};

export default RelayManager;
