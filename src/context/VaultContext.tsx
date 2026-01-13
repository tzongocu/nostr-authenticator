import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import {
  vaultExists,
  createVault,
  unlockVault,
  saveVault,
  deleteVault,
  getVaultSettings,
  loadUnencryptedVault,
  saveUnencryptedVault,
  enablePinWithData,
  disablePin,
  type VaultData,
} from '@/lib/vault';
import type { NostrKey, SignLog } from '@/lib/keyStore';
import { disableBiometrics, storeCredentials, isBiometricsEnabled } from '@/hooks/useBiometrics';

interface VaultContextValue {
  pinEnabled: boolean;
  isSetup: boolean; // false = needs PIN setup (only relevant when pinEnabled)
  isUnlocked: boolean;
  keys: NostrKey[];
  logs: SignLog[];
  defaultKeyId: string | null;
  currentPin: string | null; // Exposed for biometric registration
  setupPin: (pin: string) => Promise<void>;
  unlock: (pin: string) => Promise<boolean>;
  unlockWithBiometric: (storedPin: string) => Promise<boolean>;
  verifyPin: (pin: string) => Promise<boolean>;
  lock: () => void;
  addKey: (key: NostrKey) => Promise<void>;
  updateKey: (key: NostrKey) => Promise<void>;
  removeKey: (id: string) => Promise<void>;
  addLog: (log: SignLog) => Promise<void>;
  clearLogs: () => Promise<void>;
  setDefaultKey: (id: string | null) => Promise<void>;
  resetVault: () => void;
  enablePin: (pin: string) => Promise<void>;
  turnOffPin: () => void;
}

const VaultContext = createContext<VaultContextValue | null>(null);

export const useVault = () => {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error('useVault must be used inside VaultProvider');
  return ctx;
};

export const VaultProvider = ({ children }: { children: ReactNode }) => {
  const initialSettings = getVaultSettings();

  const [pin, setPin] = useState<string | null>(null);
  const [data, setData] = useState<VaultData | null>(() =>
    initialSettings.pinEnabled ? null : loadUnencryptedVault()
  );
  const dataRef = useRef<VaultData | null>(data);

  const [pinEnabled, setPinEnabled] = useState<boolean>(initialSettings.pinEnabled);

  // Keep ref in sync with state (and also allow immediate updates inside persist)
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Auto-load unencrypted data when PIN is disabled
  useEffect(() => {
    if (!pinEnabled) {
      const loaded = loadUnencryptedVault();
      dataRef.current = loaded;
      setData(loaded);
    }
  }, [pinEnabled]);

  const isSetup = pinEnabled ? vaultExists() : false;
  const isUnlocked = pinEnabled ? data !== null && pin !== null : data !== null;

  const persist = useCallback(
    async (next: VaultData) => {
      // Important: update ref immediately so sequential ops (addKey -> setDefaultKey)
      // in the same tick won't accidentally operate on stale state.
      dataRef.current = next;

      if (pinEnabled) {
        if (!pin) return;
        await saveVault(pin, next);
      } else {
        saveUnencryptedVault(next);
      }

      setData(next);
    },
    [pin, pinEnabled]
  );

  const setupPin = useCallback(async (newPin: string) => {
    await createVault(newPin);
    const empty: VaultData = { keys: [], logs: [] };
    setPin(newPin);
    dataRef.current = empty;
    setData(empty);
    setPinEnabled(true);
  }, []);

  const unlock = useCallback(async (inputPin: string): Promise<boolean> => {
    try {
      const vaultData = await unlockVault(inputPin);
      setPin(inputPin);
      dataRef.current = vaultData;
      setData(vaultData);
      return true;
    } catch {
      return false;
    }
  }, []);

  const lock = useCallback(() => {
    if (pinEnabled) {
      setPin(null);
      dataRef.current = null;
      setData(null);
    }
  }, [pinEnabled]);

  // Unlock vault with biometrics using PIN from secure keychain
  const unlockWithBiometric = useCallback(async (storedPin: string): Promise<boolean> => {
    try {
      const vaultData = await unlockVault(storedPin);
      setPin(storedPin);
      dataRef.current = vaultData;
      setData(vaultData);
      return true;
    } catch {
      return false;
    }
  }, []);

  const verifyPin = useCallback(async (inputPin: string): Promise<boolean> => {
    try {
      await unlockVault(inputPin);
      return true;
    } catch {
      return false;
    }
  }, []);

  const addKey = useCallback(
    async (key: NostrKey) => {
      // When PIN is enabled, only allow writes while unlocked
      if (pinEnabled && !pin) return;

      const base: VaultData = dataRef.current ?? { keys: [], logs: [] };
      const next: VaultData = { ...base, keys: [...base.keys, key] };
      await persist(next);
    },
    [persist, pinEnabled, pin]
  );

  const updateKey = useCallback(
    async (key: NostrKey) => {
      if (pinEnabled && !pin) return;

      const base: VaultData = dataRef.current ?? { keys: [], logs: [] };
      const next: VaultData = { ...base, keys: base.keys.map((k) => k.id === key.id ? key : k) };
      await persist(next);
    },
    [persist, pinEnabled, pin]
  );

  const removeKey = useCallback(
    async (id: string) => {
      if (pinEnabled && !pin) return;

      const base: VaultData = dataRef.current ?? { keys: [], logs: [] };
      const next: VaultData = { ...base, keys: base.keys.filter((k) => k.id !== id) };
      await persist(next);
    },
    [persist, pinEnabled, pin]
  );

  const addLog = useCallback(
    async (log: SignLog) => {
      if (pinEnabled && !pin) return;

      const base: VaultData = dataRef.current ?? { keys: [], logs: [] };
      const next: VaultData = { ...base, logs: [log, ...base.logs].slice(0, 100) };
      await persist(next);
    },
    [persist, pinEnabled, pin]
  );

  const clearLogs = useCallback(
    async () => {
      if (pinEnabled && !pin) return;

      const base: VaultData = dataRef.current ?? { keys: [], logs: [] };
      const next: VaultData = { ...base, logs: [] };
      await persist(next);
    },
    [persist, pinEnabled, pin]
  );

  const setDefaultKey = useCallback(
    async (id: string | null) => {
      if (pinEnabled && !pin) return;

      const base: VaultData = dataRef.current ?? { keys: [], logs: [] };
      const next: VaultData = { ...base, defaultKeyId: id ?? undefined };
      await persist(next);
    },
    [persist, pinEnabled, pin]
  );

  const resetVault = useCallback(() => {
    // Clear biometrics credentials when resetting vault
    disableBiometrics();
    deleteVault();
    setPin(null);
    setPinEnabled(false);
    const empty: VaultData = { keys: [], logs: [] };
    dataRef.current = empty;
    setData(empty);
  }, []);

  const enablePin = useCallback(
    async (newPin: string) => {
      const currentData = dataRef.current ?? { keys: [], logs: [] };
      await enablePinWithData(newPin, currentData);
      setPin(newPin);
      setPinEnabled(true);
      // keep currentData in memory (still unlocked)
      dataRef.current = currentData;
      setData(currentData);
      
      // Update biometrics keychain if biometrics was enabled
      if (isBiometricsEnabled()) {
        await storeCredentials(newPin);
      }
    },
    []
  );

  const turnOffPin = useCallback(() => {
    // Clear biometrics credentials when disabling PIN
    disableBiometrics();
    const current = dataRef.current;
    if (current) {
      disablePin(current);
    }
    setPin(null);
    setPinEnabled(false);
  }, []);

  return (
    <VaultContext.Provider
      value={{
        pinEnabled,
        isSetup,
        isUnlocked,
        keys: data?.keys ?? [],
        logs: data?.logs ?? [],
        defaultKeyId: data?.defaultKeyId ?? null,
        currentPin: pin,
        setupPin,
        unlock,
        unlockWithBiometric,
        verifyPin,
        lock,
        addKey,
        updateKey,
        removeKey,
        addLog,
        clearLogs,
        setDefaultKey,
        resetVault,
        enablePin,
        turnOffPin,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
};
