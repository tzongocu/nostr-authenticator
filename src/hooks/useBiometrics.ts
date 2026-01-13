/**
 * Native Biometric authentication hook using capacitor-native-biometric
 * For Android/iOS native apps via Capacitor
 * Stores PIN securely in device keychain for biometric unlock
 */

import { NativeBiometric, BiometryType } from 'capacitor-native-biometric';
import { Capacitor } from '@capacitor/core';

const BIOMETRICS_ENABLED_KEY = 'nostr-vault-biometrics-enabled';
const CREDENTIALS_SERVER = 'nostr-authenticator-vault';

export const isBiometricsSupported = (): boolean => {
  return true;
};

export const isBiometricsEnabled = (): boolean => {
  try {
    return localStorage.getItem(BIOMETRICS_ENABLED_KEY) === 'true';
  } catch {
    return false;
  }
};

export const setBiometricsEnabled = (enabled: boolean): void => {
  try {
    if (enabled) {
      localStorage.setItem(BIOMETRICS_ENABLED_KEY, 'true');
    } else {
      localStorage.removeItem(BIOMETRICS_ENABLED_KEY);
    }
  } catch {
    // ignore
  }
};

/**
 * Check if native biometrics are available on the device
 */
export const checkBiometricAvailability = async (): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  try {
    const result = await NativeBiometric.isAvailable();
    return result.isAvailable;
  } catch {
    return false;
  }
};

/**
 * Get the type of biometric available (fingerprint, face, etc.)
 */
export const getBiometricType = async (): Promise<BiometryType | null> => {
  if (!Capacitor.isNativePlatform()) {
    return null;
  }

  try {
    const result = await NativeBiometric.isAvailable();
    if (result.isAvailable) {
      return result.biometryType;
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Store PIN securely in device keychain (called when enabling biometrics)
 */
export const storeCredentials = async (pin: string): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  try {
    await NativeBiometric.setCredentials({
      username: 'vault-pin',
      password: pin,
      server: CREDENTIALS_SERVER,
    });
    return true;
  } catch {
    return false;
  }
};

/**
 * Remove stored credentials from keychain (called when disabling biometrics)
 */
export const deleteCredentials = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    await NativeBiometric.deleteCredentials({
      server: CREDENTIALS_SERVER,
    });
  } catch {
    // ignore - credentials might not exist
  }
};

/**
 * Get stored PIN from keychain after biometric verification
 */
export const getStoredPin = async (): Promise<string | null> => {
  if (!Capacitor.isNativePlatform()) {
    return null;
  }

  try {
    const credentials = await NativeBiometric.getCredentials({
      server: CREDENTIALS_SERVER,
    });
    return credentials.password || null;
  } catch {
    return null;
  }
};

/**
 * Register biometric and store PIN securely
 */
export const registerBiometric = async (pin: string): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  try {
    const available = await checkBiometricAvailability();
    if (!available) {
      return false;
    }

    // Verify the user can authenticate before enabling
    await NativeBiometric.verifyIdentity({
      reason: 'Enable biometric authentication',
      title: 'Biometric Setup',
      subtitle: 'Verify your identity to enable biometrics',
      description: 'Use your fingerprint or face to unlock the app',
    });

    // Store PIN in secure keychain
    const stored = await storeCredentials(pin);
    if (!stored) {
      return false;
    }

    setBiometricsEnabled(true);
    return true;
  } catch {
    return false;
  }
};

/**
 * Disable biometrics and remove stored credentials
 */
export const disableBiometrics = async (): Promise<void> => {
  await deleteCredentials();
  setBiometricsEnabled(false);
};

/**
 * Authenticate with biometrics and return stored PIN
 */
export const authenticateWithBiometric = async (): Promise<string | null> => {
  if (!Capacitor.isNativePlatform()) {
    return null;
  }

  if (!isBiometricsEnabled()) {
    return null;
  }

  try {
    const available = await checkBiometricAvailability();
    if (!available) {
      return null;
    }

    await NativeBiometric.verifyIdentity({
      reason: 'Unlock Nostr Authenticator',
      title: 'Unlock App',
      subtitle: 'Verify your identity',
      description: 'Use your fingerprint or face to unlock',
    });

    // Return the stored PIN after successful biometric auth
    return await getStoredPin();
  } catch {
    return null;
  }
};
