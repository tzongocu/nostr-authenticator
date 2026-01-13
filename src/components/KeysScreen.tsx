import { useState } from 'react';
import { Key, Plus, Trash2, Eye, EyeOff, Copy, Check, ChevronRight, X, Star, AlertTriangle, Pencil } from 'lucide-react';
import { useVault } from '@/context/VaultContext';
import { generateKeyPair, derivePublicKey, isValidNsec, KEY_COLORS, type NostrKey } from '@/lib/keyStore';
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

const KeysScreen = () => {
  const { keys, addKey, removeKey, updateKey, defaultKeyId, setDefaultKey } = useVault();
  const [selectedKey, setSelectedKey] = useState<NostrKey | null>(null);
  const [showPrivate, setShowPrivate] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyColor, setNewKeyColor] = useState(KEY_COLORS[0].value);
  const [importMode, setImportMode] = useState(false);
  const [importPrivate, setImportPrivate] = useState('');
const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const handleAddKey = async () => {
    if (!newKeyName.trim()) {
      toast.error('Enter a name for the key');
      return;
    }

    try {
      let publicKey: string;
      let privateKey: string;

      if (importMode) {
        const nsec = importPrivate.trim();
        if (!nsec) {
          toast.error('Enter the private key (nsec)');
          return;
        }
        if (!isValidNsec(nsec)) {
          toast.error('Invalid nsec format');
          return;
        }
        const derivedPub = derivePublicKey(nsec);
        if (!derivedPub) {
          toast.error('Could not derive public key');
          return;
        }
        publicKey = derivedPub;
        privateKey = nsec;
      } else {
        const generated = generateKeyPair();
        publicKey = generated.publicKey;
        privateKey = generated.privateKey;
      }

      const newKey: NostrKey = {
        id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: newKeyName.trim(),
        publicKey,
        privateKey,
        createdAt: new Date(),
        color: newKeyColor,
      };

      await addKey(newKey);

      setShowAddModal(false);
      setNewKeyName('');
      setNewKeyColor(KEY_COLORS[0].value);
      setImportPrivate('');
      setImportMode(false);
      toast.success('Key added successfully');
    } catch {
      toast.error('Could not save key. Try again.');
    }
  };

  const handleDeleteKey = async () => {
    if (!selectedKey) return;
    await removeKey(selectedKey.id);
    // If deleting the default key, clear default
    if (defaultKeyId === selectedKey.id) {
      await setDefaultKey(null);
    }
    setSelectedKey(null);
    setShowDeleteDialog(false);
    toast.success('Key deleted');
  };

  const handleSetDefault = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (defaultKeyId === id) {
      await setDefaultKey(null);
      toast.success('Default key removed');
    } else {
      await setDefaultKey(id);
      toast.success('Key set as default');
    }
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
    toast.success('Copied to clipboard');
  };

  const handleColorChange = async (color: string) => {
    if (!selectedKey) return;
    const updated = { ...selectedKey, color };
    await updateKey(updated);
    setSelectedKey(updated);
    toast.success('Color updated');
  };

  const handleRename = async () => {
    if (!selectedKey || !renameValue.trim()) return;
    const updated = { ...selectedKey, name: renameValue.trim() };
    await updateKey(updated);
    setSelectedKey(updated);
    setShowRenameDialog(false);
    setRenameValue('');
    toast.success('Key renamed');
  };

  const keyColor = selectedKey?.color || KEY_COLORS[0].value;

  if (selectedKey) {
    const isDefault = defaultKeyId === selectedKey.id;
    
    return (
      <div className="h-full flex flex-col p-4 min-h-0">
        <button
          onClick={() => {
            setSelectedKey(null);
            setShowPrivate(false);
          }}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
          <span>Back</span>
        </button>

        <div className="glass-card rounded-2xl p-5 neon-border mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ 
                backgroundColor: `${keyColor}20`,
                boxShadow: `0 0 12px ${keyColor}, 0 0 24px ${keyColor}50`
              }}
            >
              <Key className="w-6 h-6" style={{ color: keyColor }} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-foreground">{selectedKey.name}</h2>
                {isDefault && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                <button
                  onClick={() => {
                    setRenameValue(selectedKey.name);
                    setShowRenameDialog(true);
                  }}
                  className="p-1 hover:bg-primary/20 rounded-lg transition-colors"
                  title="Rename key"
                >
                  <Pencil className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                Created: {selectedKey.createdAt.toLocaleDateString('en-US')}
              </p>
              {/* Rainbow Color Bubbles - aligned with text */}
              <div className="flex items-center gap-1.5">
                {KEY_COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => handleColorChange(c.value)}
                    className={`w-2.5 h-2.5 rounded-full transition-all duration-200 hover:scale-150 hover:shadow-lg ${
                      keyColor === c.value ? 'ring-1 ring-foreground ring-offset-1 ring-offset-background scale-125' : ''
                    }`}
                    style={{ 
                      backgroundColor: c.value,
                      boxShadow: keyColor === c.value ? `0 0 8px ${c.value}` : 'none'
                    }}
                    title={c.name}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Public Key */}
        <div className="glass-card rounded-xl p-4 neon-border mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">Public Key</span>
            <button
              onClick={() => handleCopy(selectedKey.publicKey, 'public')}
              className="p-2 hover:bg-primary/20 rounded-lg transition-colors"
            >
              {copiedField === 'public' ? (
                <Check className="w-4 h-4 text-primary" />
              ) : (
                <Copy className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
          </div>
          <p className="text-sm font-mono text-foreground break-all">{selectedKey.publicKey}</p>
        </div>

        {/* Private Key */}
        <div className="glass-card rounded-xl p-4 neon-border mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">Private Key</span>
            <div className="flex gap-2">
              <button
                onClick={() => setShowPrivate(!showPrivate)}
                className="p-2 hover:bg-primary/20 rounded-lg transition-colors"
              >
                {showPrivate ? (
                  <EyeOff className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <Eye className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
              <button
                onClick={() => handleCopy(selectedKey.privateKey, 'private')}
                className="p-2 hover:bg-primary/20 rounded-lg transition-colors"
              >
                {copiedField === 'private' ? (
                  <Check className="w-4 h-4 text-primary" />
                ) : (
                  <Copy className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
            </div>
          </div>
          <p className="text-sm font-mono text-foreground break-all">
            {showPrivate ? selectedKey.privateKey : '•'.repeat(40)}
          </p>
        </div>

        {/* Delete button */}
        <button
          onClick={() => setShowDeleteDialog(true)}
          className="flex items-center justify-center gap-2 py-4 rounded-xl border border-destructive/50 text-destructive hover:bg-destructive/10 transition-colors"
        >
          <Trash2 className="w-5 h-5" />
          <span className="font-medium">Delete Key</span>
        </button>

        {/* Delete Key Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                Delete Key
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <p>
                  You are about to permanently delete the key <strong>"{selectedKey.name}"</strong>.
                </p>
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 space-y-2">
                  <p className="font-semibold text-destructive text-sm">
                    ⚠️ This action cannot be undone!
                  </p>
                  <p className="text-sm">
                    Once deleted, this key cannot be recovered. You will lose access to any Nostr accounts or services that use this key.
                  </p>
                </div>
                <p className="text-sm font-medium">
                  Before deleting, make sure you have saved your private key (nsec) in a secure location if you want to use it again in the future.
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteKey} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete Key
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Rename Key Dialog */}
        <AlertDialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-primary" />
                Rename Key
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-4">
                  <p>Enter a new name for this key:</p>
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    placeholder="New key name"
                    className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    autoFocus
                  />
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setRenameValue('')}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleRename} disabled={!renameValue.trim()}>
                Rename
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Clickable empty space to close */}
        <div 
          className="flex-1 min-h-[100px] cursor-pointer"
          onClick={() => {
            setSelectedKey(null);
            setShowPrivate(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header */}
      <div className="shrink-0 bg-background/80 backdrop-blur-sm p-4 pb-2 z-10">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Key className="w-6 h-6 text-primary" />
            My Keys
          </h2>
          <button
            onClick={() => setShowAddModal(true)}
            className="p-3 rounded-xl bg-primary text-primary-foreground neon-glow transition-all hover:opacity-90 active:scale-95"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      {/* Scrollable Content */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-4 pb-4">

      {keys.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <Key className="w-16 h-16 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground mb-4">No keys added</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium neon-glow"
          >
            Add First Key
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-hide space-y-3 pb-4">
          {keys.map((key, index) => {
            const isDefault = defaultKeyId === key.id;
            return (
              <div
                key={key.id}
                className="w-full glass-card rounded-xl p-4 neon-border flex items-center gap-3 transition-all hover:bg-card/80"
                style={{
                  animationDelay: `${index * 50}ms`,
                  animation: 'fadeIn 0.3s ease-out forwards',
                  opacity: 0,
                }}
              >
                {/* Default star button */}
                <button
                  onClick={(e) => handleSetDefault(key.id, e)}
                  className="p-2 rounded-lg hover:bg-primary/20 transition-colors"
                  title={isDefault ? 'Default key' : 'Set as default'}
                >
                  <Star className={`w-5 h-5 ${isDefault ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground'}`} />
                </button>
                
                <button
                  onClick={() => setSelectedKey(key)}
                  className="flex-1 flex items-center gap-3 text-left"
                >
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ 
                      backgroundColor: `${key.color || KEY_COLORS[0].value}20`,
                      boxShadow: `0 0 10px ${key.color || KEY_COLORS[0].value}, 0 0 20px ${key.color || KEY_COLORS[0].value}50`
                    }}
                  >
                    <Key className="w-5 h-5" style={{ color: key.color || KEY_COLORS[0].value }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{key.name}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      {key.publicKey.slice(0, 20)}...
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Warning note */}
      <div className="mt-auto pt-4 pb-2">
        <div className="flex items-start gap-2 opacity-50">
          <AlertTriangle className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Save your private key (nsec) in a secure location. Nostr Authenticator by botrift.com is not responsible for lost keys.
          </p>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <Portal>
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md glass-card rounded-2xl p-6 neon-border animate-[slideUp_0.3s_ease-out] max-h-[calc(100vh-4rem)] overflow-y-auto scrollbar-hide">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-foreground">Add Key</h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setImportMode(false);
                  setNewKeyName('');
                  setNewKeyColor(KEY_COLORS[0].value);
                  setImportPrivate('');
                }}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Toggle */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setImportMode(false)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  !importMode ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >
                Generate New
              </button>
              <button
                onClick={() => setImportMode(true)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  importMode ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >
                Import
              </button>
            </div>

            <input
              type="text"
              placeholder="Key name"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary mb-4"
            />

            {/* Color selector */}
            <div className="mb-4">
              <p className="text-sm text-muted-foreground mb-2">Key Color</p>
              <div className="flex flex-wrap gap-2">
                {KEY_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setNewKeyColor(c.value)}
                    className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${
                      newKeyColor === c.value ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background' : ''
                    }`}
                    style={{ backgroundColor: c.value }}
                    title={c.name}
                  />
                ))}
              </div>
            </div>

            {importMode && (
              <input
                type="password"
                placeholder="Private Key (nsec1...)"
                value={importPrivate}
                onChange={(e) => setImportPrivate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary mb-4 font-mono text-sm"
              />
            )}

            <button
              onClick={handleAddKey}
              className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold neon-glow transition-all hover:opacity-90"
            >
              {importMode ? 'Import Key' : 'Generate Key'}
            </button>
            </div>
          </div>
        </Portal>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(100%); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      </div>
    </div>
  );
};

export default KeysScreen;
