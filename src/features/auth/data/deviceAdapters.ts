import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

import { secureStorage, storageKeys } from '@/core/storage/secureStorage';

import type { BiometricGateway, SecretStore } from '../domain/ports';

function generateRandomBase64(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < byteLength; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

/** Sensor biométrico vía expo-local-authentication. En web no hay biometría. */
export const biometricGateway: BiometricGateway = {
  async isAvailable() {
    if (Platform.OS === 'web') return false;
    try {
      const [hasHardware, enrolled] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ]);
      return hasHardware && enrolled;
    } catch {
      return false;
    }
  },

  async authenticate(promptMessage) {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Cancelar',
      disableDeviceFallback: true,
    });
    return result.success;
  },

  async generateSecret() {
    return generateRandomBase64(32);
  },
};

/** Persistencia segura de tokens y secretos (SecureStore en móvil). */
export const secretStore: SecretStore = {
  getBiometricSecret: (email) =>
    Platform.OS === 'web'
      ? Promise.resolve(null)
      : secureStorage.getItem(storageKeys.biometricSecret(email)),
  saveBiometricSecret: (email, secret) =>
    Platform.OS === 'web'
      ? Promise.resolve()
      : secureStorage.setItem(storageKeys.biometricSecret(email), secret),
  removeBiometricSecret: (email) => secureStorage.removeItem(storageKeys.biometricSecret(email)),
  getRefreshToken: () => secureStorage.getItem(storageKeys.refreshToken),
  saveRefreshToken: (token) => secureStorage.setItem(storageKeys.refreshToken, token),
  clearRefreshToken: () => secureStorage.removeItem(storageKeys.refreshToken),
  getLastEmail: () => secureStorage.getItem(storageKeys.lastEmail),
  saveLastEmail: (email) => secureStorage.setItem(storageKeys.lastEmail, email),
};
