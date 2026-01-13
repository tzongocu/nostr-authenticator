import { useState, useEffect } from 'react';
import { X, User, RotateCcw, Check, AlertCircle } from 'lucide-react';
import Portal from './Portal';
import { getAdminNpub, setAdminNpub, resetAdminNpub, isValidNpub, DEFAULT_ADMIN_NPUB } from '@/lib/adminStore';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

interface AdminManagerProps {
  onClose: () => void;
}

const AdminManager = ({ onClose }: AdminManagerProps) => {
  const [npub, setNpub] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setNpub(getAdminNpub());
  }, []);

  const handleSave = () => {
    if (!isValidNpub(npub.trim())) {
      setError('Invalid npub format (must start with npub1 and be 63 characters)');
      return;
    }

    setAdminNpub(npub.trim());
    setIsEditing(false);
    setError('');
    toast.success('Admin npub updated - restart app to apply');
  };

  const handleReset = () => {
    resetAdminNpub();
    setNpub(DEFAULT_ADMIN_NPUB);
    setIsEditing(false);
    setError('');
    toast.success('Admin npub reset to default - restart app to apply');
  };

  const handleCancel = () => {
    setNpub(getAdminNpub());
    setIsEditing(false);
    setError('');
  };

  const isDefault = npub === DEFAULT_ADMIN_NPUB;

  const truncateNpub = (key: string) => {
    if (key.length <= 20) return key;
    return `${key.slice(0, 12)}...${key.slice(-8)}`;
  };

  return (
    <Portal>
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-card rounded-2xl neon-border w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Admin Account
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            This is the Nostr account that sends authentication requests. Only messages from this account will be shown as login requests.
          </p>

          {/* Current Admin */}
          <div className="glass-card rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Admin npub</span>
              {isDefault && (
                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                  Default
                </span>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-3">
                <textarea
                  value={npub}
                  onChange={(e) => {
                    setNpub(e.target.value);
                    setError('');
                  }}
                  placeholder="npub1..."
                  className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={3}
                />
                {error && (
                  <div className="flex items-center gap-2 text-destructive text-sm">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    onClick={handleSave}
                    size="sm"
                    className="flex-1"
                  >
                    <Check className="w-4 h-4 mr-1" />
                    Save
                  </Button>
                  <Button
                    onClick={handleCancel}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="font-mono text-sm text-muted-foreground break-all bg-muted/50 p-2 rounded-lg">
                  {truncateNpub(npub)}
                </p>
                <Button
                  onClick={() => setIsEditing(true)}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  Edit
                </Button>
              </div>
            )}
          </div>

          {/* Reset to Default */}
          {!isDefault && !isEditing && (
            <Button
              onClick={handleReset}
              variant="ghost"
              className="w-full text-muted-foreground"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset to Default
            </Button>
          )}
        </div>
        </div>
      </div>
    </Portal>
  );
};

export default AdminManager;
