import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nostr.authenticator',
  appName: 'Nostr Authenticator',
  webDir: 'dist',
  // No server.url - app loads from local dist folder for production
};

export default config;
