const STORAGE_KEY = 'nostr-admin-npub';

export const DEFAULT_ADMIN_NPUB = 'npub17455p39xfnhetmr5sp4uu75gcvwe2lze0y45a5gc9lrqf3pu2dlskyvgla';

export const getAdminNpub = (): string => {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored || DEFAULT_ADMIN_NPUB;
};

export const setAdminNpub = (npub: string): void => {
  localStorage.setItem(STORAGE_KEY, npub);
};

export const resetAdminNpub = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};

export const isValidNpub = (npub: string): boolean => {
  return npub.startsWith('npub1') && npub.length === 63;
};
