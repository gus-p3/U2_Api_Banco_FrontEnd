import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Almacenamiento seguro clave-valor.
 * - Móvil: expo-secure-store (Keystore de Android).
 * - Web: sessionStorage (se borra al cerrar la pestaña; no persiste entre sesiones).
 *   No existe almacenamiento verdaderamente seguro en navegador; por eso en web
 *   no se guarda ningún secreto biométrico y los tokens viven solo la pestaña.
 */
export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const webStorage: KeyValueStorage = {
  async getItem(key) {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(key);
  },
  async setItem(key, value) {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(key, value);
  },
  async removeItem(key) {
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(key);
  },
};

const nativeStorage: KeyValueStorage = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

export const secureStorage: KeyValueStorage = Platform.OS === 'web' ? webStorage : nativeStorage;

/** Claves permitidas (SecureStore solo acepta [A-Za-z0-9._-]). */
export const storageKeys = {
  refreshToken: 'banco.refreshToken',
  lastEmail: 'banco.lastEmail',
  biometricSecret: (email: string) => `banco.bio.${email.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
} as const;
