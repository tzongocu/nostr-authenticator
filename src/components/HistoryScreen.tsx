import { useState } from 'react';
import { Clock, Key, History, ChevronDown, ChevronUp, CheckCircle, XCircle, Trash2, Shield } from 'lucide-react';
import { useVault } from '@/context/VaultContext';
import { KEY_COLORS } from '@/lib/keyStore';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const HistoryScreen = () => {
  const { logs, keys, clearLogs } = useVault();
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  const getKeyColor = (keyId: string) => {
    const key = keys.find(k => k.id === keyId);
    return key?.color || KEY_COLORS[0].value;
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
  };

  const formatFullDate = (date: Date) => {
    return date.toLocaleString('en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const toggleExpanded = (id: string) => {
    setExpandedLogs(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header */}
      <div className="shrink-0 bg-background/80 backdrop-blur-sm p-4 pb-2 z-10">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <History className="w-6 h-6 text-primary" />
            Authorization History
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {logs.length} entries
            </span>
            {logs.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear History</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete all history entries? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={clearLogs} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </div>
      
      {/* Scrollable Content */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-4 pb-4">

      {logs.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <Shield className="w-16 h-16 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground text-center">
            No authorizations yet
          </p>
          <p className="text-xs text-muted-foreground/70 mt-2 text-center">
            History will appear after you accept or deny requests
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-hide space-y-3 pb-4">
          {[...logs].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).map((log, index) => (
            <Collapsible
              key={log.id}
              open={expandedLogs.has(log.id)}
              onOpenChange={() => toggleExpanded(log.id)}
            >
              <div
                className="glass-card rounded-xl neon-border transition-all hover:bg-card/80 overflow-hidden"
                style={{
                  animationDelay: `${index * 50}ms`,
                  animation: 'fadeIn 0.3s ease-out forwards',
                  opacity: 0,
                }}
              >
                <CollapsibleTrigger asChild>
                  <button className="w-full p-4 text-left">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          log.action === 'Accepted' ? 'bg-green-500/20' : 
                          log.action === 'Denied' ? 'bg-red-500/20' : 'bg-muted/50'
                        }`}>
                          {log.action === 'Accepted' ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : log.action === 'Denied' ? (
                            <XCircle className="w-4 h-4 text-red-500" />
                          ) : (
                            <Clock className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground text-sm">
                            {(log.app || 'Unknown').replace(/^https?:\/\//, '').replace(/\/$/, '')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {log.action} • <span style={{ color: getKeyColor(log.keyId) }}>{log.keyName}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{formatTime(log.timestamp)}</span>
                        {expandedLogs.has(log.id) ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </button>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <div className="px-4 pb-4 pt-0 space-y-3 border-t border-border/50">
                    {/* Action */}
                    <div className="flex items-center gap-2 pt-3">
                      {log.action === 'Accepted' ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : log.action === 'Denied' ? (
                        <XCircle className="w-4 h-4 text-red-500" />
                      ) : (
                        <Clock className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className="text-xs text-muted-foreground">Action:</span>
                      <span className={`text-xs font-medium ${
                        log.action === 'Accepted' ? 'text-green-500' : 
                        log.action === 'Denied' ? 'text-red-500' : 'text-muted-foreground'
                      }`}>
                        {log.action}
                      </span>
                    </div>
                    
                    {/* Site */}
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Site:</span>
                      {log.app ? (
                        <a 
                          href={log.app.startsWith('http') ? log.app : `https://${log.app.replace(/^https?:\/\//, '').replace(/\/$/, '')}`}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-primary font-medium hover:underline cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {log.app.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                        </a>
                      ) : (
                        <span className="text-xs text-foreground">Unknown</span>
                      )}
                    </div>
                    
                    {/* Key */}
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ 
                          backgroundColor: `${getKeyColor(log.keyId)}20`,
                          boxShadow: `0 0 8px ${getKeyColor(log.keyId)}, 0 0 16px ${getKeyColor(log.keyId)}50`
                        }}
                      >
                        <Key className="w-3 h-3" style={{ color: getKeyColor(log.keyId) }} />
                      </div>
                      <span className="text-xs text-muted-foreground">Key:</span>
                      <span className="text-xs" style={{ color: getKeyColor(log.keyId) }}>{log.keyName}</span>
                    </div>
                    
                    {/* Timestamp */}
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Date and time:</span>
                      <span className="text-xs text-foreground">{formatFullDate(log.timestamp)}</span>
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))}
        </div>
      )}
      </div>

    </div>
  );
};

export default HistoryScreen;