import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { X, Shield, AlertTriangle, Lock, CheckCircle, Fingerprint } from 'lucide-react';
import { APP_VERSION } from '@/lib/constants';
import { useVault } from '@/context/VaultContext';
import Portal from './Portal';
import logo from '@/assets/logo.png';
import {
  isBiometricsEnabled,
  authenticateWithBiometric,
  checkBiometricAvailability,
} from '@/hooks/useBiometrics';

interface PinScreenProps {
  isSetup: boolean;
  isDisable?: boolean;
  onCancel?: () => void;
  onSuccess?: () => void;
}

const MAX_ATTEMPTS = 5;
const ATTEMPTS_KEY = 'pin_failed_attempts';

const getFailedAttempts = (): number => {
  try {
    return parseInt(localStorage.getItem(ATTEMPTS_KEY) || '0', 10);
  } catch {
    return 0;
  }
};

const setFailedAttempts = (count: number) => {
  try {
    localStorage.setItem(ATTEMPTS_KEY, count.toString());
  } catch {
    // ignore
  }
};

const clearFailedAttempts = () => {
  try {
    localStorage.removeItem(ATTEMPTS_KEY);
  } catch {
    // ignore
  }
};

const PinScreen = ({ isSetup, isDisable, onCancel, onSuccess }: PinScreenProps) => {
  const { setupPin, unlock, unlockWithBiometric, verifyPin, enablePin, turnOffPin, resetVault } = useVault();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'info' | 'enter' | 'confirm' | 'success'>(isSetup ? 'info' : 'enter');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failedAttempts, setFailedAttemptsState] = useState(getFailedAttempts);
  const [showWipeAlert, setShowWipeAlert] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);

  // Check biometrics availability on mount (only for unlock flow)
  useEffect(() => {
    if (!isSetup && !isDisable) {
      if (!Capacitor.isNativePlatform()) {
        setBiometricsAvailable(false);
        return;
      }

      checkBiometricAvailability().then((available) => {
        setBiometricsAvailable(available && isBiometricsEnabled());
      });
    }
  }, [isSetup, isDisable]);

  // Auto-trigger biometrics on mount
  useEffect(() => {
    if (biometricsAvailable && !isSetup && !isDisable) {
      handleBiometricAuth();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [biometricsAvailable]);

  const handleBiometricAuth = async () => {
    if (loading) return;
    setLoading(true);
    setError('');

    try {
      const storedPin = await authenticateWithBiometric();
      if (storedPin) {
        const success = await unlockWithBiometric(storedPin);
        if (success) {
          clearFailedAttempts();
          setFailedAttemptsState(0);
        } else {
          setError('Biometric unlock failed');
        }
      }
      // silent fail - user can use PIN
    } catch {
      // silent fail - user can use PIN
    } finally {
      setLoading(false);
    }
  };

  const handleNumber = (num: string) => {
    const current = step === 'confirm' ? confirmPin : pin;
    if (current.length < 6) {
      if (step === 'confirm') {
        setConfirmPin((prev) => prev + num);
      } else {
        setPin((prev) => prev + num);
      }
      setError('');
    }
  };

  const handleClear = () => {
    if (step === 'confirm') {
      setConfirmPin('');
    } else {
      setPin('');
    }
  };

  const validatePin = async () => {
    if (loading) return;
    setLoading(true);

    if (isSetup) {
      // Setup flow
      if (step === 'enter') {
        setConfirmPin('');
        setStep('confirm');
        setLoading(false);
      } else {
        if (pin === confirmPin) {
          try {
            // Use enablePin if onCancel exists (enabling from settings), otherwise setupPin (first time)
            if (onCancel) {
              await enablePin(pin);
              setStep('success');
            } else {
              await setupPin(pin);
            }
          } catch {
            setError('Cannot create vault.');
            setShake(true);
            setTimeout(() => setShake(false), 500);
          }
        } else {
          setError('PINs do not match');
          setShake(true);
          setTimeout(() => setShake(false), 500);
          setConfirmPin('');
          setPin('');
          setStep('enter');
        }
        setLoading(false);
      }
    } else if (isDisable) {
      // Disable PIN flow - verify current PIN then disable (no side effects)
      const ok = await verifyPin(pin);
      if (ok) {
        clearFailedAttempts();
        setFailedAttemptsState(0);
        turnOffPin();
        if (onSuccess) onSuccess();
      } else {
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);
        setFailedAttemptsState(newAttempts);
        
        if (newAttempts >= MAX_ATTEMPTS) {
          setShowWipeAlert(true);
        } else {
          setError(`Incorrect PIN (${MAX_ATTEMPTS - newAttempts} attempts left)`);
          setShake(true);
          setTimeout(() => setShake(false), 500);
          setPin('');
        }
      }
      setLoading(false);
    } else {
      // Unlock flow
      const ok = await unlock(pin);
      if (ok) {
        clearFailedAttempts();
        setFailedAttemptsState(0);
      } else {
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);
        setFailedAttemptsState(newAttempts);
        
        if (newAttempts >= MAX_ATTEMPTS) {
          setShowWipeAlert(true);
        } else {
          setError(`Incorrect PIN (${MAX_ATTEMPTS - newAttempts} attempts left)`);
          setShake(true);
          setTimeout(() => setShake(false), 500);
          setPin('');
        }
      }
      setLoading(false);
    }
  };

  const handleWipeAndReset = () => {
    clearFailedAttempts();
    resetVault();
    setShowWipeAlert(false);
    window.location.reload();
  };

  useEffect(() => {
    const current = step === 'confirm' ? confirmPin : pin;
    if (current.length === 6 && step !== 'success') {
      validatePin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, confirmPin]);

  const currentPin = step === 'confirm' ? confirmPin : pin;
  // Show biometric button in bottom-right of keypad if available (unlock flow only)
  const showBiometricButton = biometricsAvailable && !isSetup && !isDisable;
  const numbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', showBiometricButton ? 'bio' : ''];

  // Success screen after PIN setup
  if (step === 'success') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Background overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/90 via-background/95 to-background z-0 pointer-events-none" />

        {/* Main content */}
        <div className="relative z-20 flex flex-col items-center w-full max-w-sm px-4">
          {/* Icon */}
          <div className="mb-6">
            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center neon-glow">
              <CheckCircle className="w-10 h-10 text-primary" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-foreground mb-2 text-center">
            PIN Activated!
          </h1>
          <p className="text-muted-foreground text-sm mb-8 text-center">
            Your keys are now encrypted and protected with your PIN.
          </p>

          {/* Info */}
          <div className="w-full glass-card rounded-xl p-4 neon-border mb-8">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-foreground text-sm">Encryption Active</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Your private keys are now secured with AES-256-GCM encryption. You'll need to enter your PIN each time you open the app.
                </p>
              </div>
            </div>
          </div>

          {/* Button */}
          <button
            onClick={() => {
              if (onSuccess) {
                onSuccess();
              } else if (onCancel) {
                onCancel();
              }
            }}
            className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold neon-glow transition-all hover:opacity-90"
          >
            Back to Settings
          </button>
        </div>
      </div>
    );
  }

  // Info screen before PIN setup
  if (step === 'info' && isSetup) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Cancel button */}
        {onCancel && (
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 z-30 p-2 rounded-full glass-card hover:bg-card/80 transition-colors"
          >
            <X className="w-6 h-6 text-muted-foreground" />
          </button>
        )}

        {/* Background overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/90 via-background/95 to-background z-0 pointer-events-none" />

        {/* Main content */}
        <div className="relative z-20 flex flex-col items-center w-full max-w-sm px-4">
          {/* Icon */}
          <div className="mb-6">
            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center neon-glow">
              <Shield className="w-10 h-10 text-primary" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-foreground mb-2 text-center">
            Enable PIN Protection
          </h1>
          <p className="text-muted-foreground text-sm mb-6 text-center">
            Secure your keys with encryption
          </p>

          {/* Info cards */}
          <div className="w-full space-y-3 mb-8">
            <div className="glass-card rounded-xl p-4 neon-border">
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-foreground text-sm">AES-256 Encryption</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your private keys will be encrypted with your PIN using military-grade AES-256-GCM encryption.
                  </p>
                </div>
              </div>
            </div>

            <div className="glass-card rounded-xl p-4 border border-destructive/30 bg-destructive/5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-destructive text-sm">No Recovery Option</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    If you forget your PIN, your encrypted keys <strong>cannot be recovered</strong>. Make sure to backup your private keys (nsec) before enabling PIN protection.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="w-full space-y-3">
            <button
              onClick={() => setStep('enter')}
              className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold neon-glow transition-all hover:opacity-90"
            >
              I Understand, Continue
            </button>
            {onCancel && (
              <button
                onClick={onCancel}
                className="w-full py-3 rounded-xl bg-muted text-muted-foreground font-medium transition-all hover:bg-muted/80"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Wipe Alert Dialog */}
      {showWipeAlert && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="glass-card rounded-2xl p-6 max-w-sm mx-4 neon-border border-destructive/50">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mb-4">
                  <AlertTriangle className="w-8 h-8 text-destructive" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">Security Alert</h2>
                <p className="text-muted-foreground text-sm mb-4">
                  Maximum PIN attempts exceeded ({MAX_ATTEMPTS} failed attempts). For security, all data will be permanently deleted.
                </p>
                <div className="w-full space-y-3">
                  <button
                    onClick={handleWipeAndReset}
                    className="w-full py-3 rounded-xl bg-destructive text-destructive-foreground font-bold transition-all hover:opacity-90"
                  >
                    Reset Application
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Portal>
      )}
      {/* Cancel button */}
      {onCancel && (
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 z-30 p-2 rounded-full glass-card hover:bg-card/80 transition-colors"
        >
          <X className="w-6 h-6 text-muted-foreground" />
        </button>
      )}

      {/* Background overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/90 via-background/95 to-background z-0 pointer-events-none" />

      {/* Animated scan lines */}
      <div className="absolute inset-0 opacity-5 pointer-events-none z-10">
        <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,hsl(var(--primary)/0.1)_2px,hsl(var(--primary)/0.1)_4px)]" />
      </div>

      {/* Main content */}
      <div className={`relative z-20 flex flex-col items-center w-full max-w-xs ${shake ? 'animate-shake' : ''}`}>
        {/* Logo */}
        <div className="mb-8 float-animation">
          <div className="relative">
            {/* Outer radiant glow layers */}
            <div className="absolute -inset-8 rounded-full bg-primary/5 blur-3xl" />
            <div className="absolute -inset-6 rounded-full bg-primary/10 blur-2xl" />
            <div className="absolute -inset-4 rounded-full bg-primary/15 blur-xl animate-pulse" />
            <img
              src={logo}
              alt="Nostr Vault"
              className="relative w-24 h-24 rounded-full"
              style={{
                boxShadow: `
                  0 0 20px hsl(var(--primary) / 0.3),
                  0 0 40px hsl(var(--primary) / 0.2),
                  0 0 60px hsl(var(--primary) / 0.15),
                  0 0 80px hsl(var(--primary) / 0.1)
                `
              }}
            />
          </div>
        </div>

        {/* App Title */}
        <h1 className="text-xl font-bold text-foreground mb-1">
          Nostr <span className="text-primary">Authenticator</span>
        </h1>
        
        {/* Subtitle */}
        <p className="text-muted-foreground text-sm mb-8 text-center">
          {isSetup
            ? step === 'enter'
              ? 'Enter a 6-digit PIN'
              : 'Confirm PIN'
            : isDisable
              ? 'Enter current PIN to disable'
              : 'Enter PIN to continue'}
        </p>

        {/* PIN dots */}
        <div className="flex gap-3 mb-8">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                i < currentPin.length
                  ? 'bg-primary border-primary neon-glow'
                  : 'border-muted-foreground/50'
              }`}
            />
          ))}
        </div>

        {/* Error message */}
        {error && (
          <p className="text-destructive text-sm mb-4 animate-pulse">{error}</p>
        )}

        {/* Number pad */}
        <div className="grid grid-cols-3 gap-4 w-full">
          {numbers.map((num, i) =>
            num === '' ? (
              <div key={i} className="h-16" />
            ) : num === 'bio' ? (
              <button
                key={i}
                onClick={handleBiometricAuth}
                disabled={loading}
                className="h-16 rounded-xl transition-all duration-200 glass-card hover:neon-border active:scale-95 disabled:opacity-50 flex items-center justify-center"
              >
                <Fingerprint className="w-7 h-7 text-primary" />
              </button>
            ) : (
              <button
                key={i}
                onClick={() => handleNumber(num)}
                disabled={loading || currentPin.length >= 6}
                className="h-16 rounded-xl text-2xl font-semibold transition-all duration-200 glass-card hover:neon-border active:scale-95 text-foreground disabled:opacity-50"
              >
                {num}
              </button>
            )
          )}
        </div>

        {/* Clear button */}
        <button
          onClick={handleClear}
          disabled={loading}
          className="mt-6 text-muted-foreground hover:text-primary transition-colors text-sm disabled:opacity-50"
        >
          Clear all
        </button>
      </div>

      {/* Footer Info */}
      <div className="absolute bottom-6 left-0 right-0 z-20">
        <div className="text-center opacity-40">
          <p className="text-xs text-muted-foreground">Nostr Authenticator v{APP_VERSION}</p>
          <p className="text-xs text-muted-foreground">
            designed by{' '}
            <a 
              href="https://botrift.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              botrift.com
            </a>
          </p>
        </div>
      </div>

      {/* Shake animation */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }
        .animate-shake { animation: shake 0.5s ease-in-out; }
      `}</style>
    </div>
  );
};

export default PinScreen;
