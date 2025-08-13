// utils/storage.js - Cross-platform storage utility
import { Platform } from 'react-native';

let SecureStore = null;

// Dynamically import expo-secure-store only on mobile platforms
if (Platform.OS === 'ios' || Platform.OS === 'android') {
  try {
    SecureStore = require('expo-secure-store');
  } catch (error) {
    console.warn('expo-secure-store not available:', error);
  }
}

/**
 * Cross-platform secure storage utility
 * Uses expo-secure-store on mobile, localStorage on web
 */
export const storage = {
  /**
   * Store a key-value pair
   * @param {string} key - Storage key
   * @param {string} value - Storage value
   * @returns {Promise<void>}
   */
  setItem: async (key, value) => {
    try {
      if (Platform.OS === 'web') {
        // Web platform - use localStorage
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem(key, value);
          return Promise.resolve();
        } else {
          throw new Error('localStorage not available');
        }
      } else {
        // Mobile platforms - use expo-secure-store
        if (SecureStore && SecureStore.setItemAsync) {
          return await SecureStore.setItemAsync(key, value);
        } else {
          throw new Error('expo-secure-store not available');
        }
      }
    } catch (error) {
      console.error(`Error storing item with key "${key}":`, error);
      throw error;
    }
  },

  /**
   * Retrieve a value by key
   * @param {string} key - Storage key
   * @returns {Promise<string|null>} - Retrieved value or null
   */
  getItem: async (key) => {
    try {
      if (Platform.OS === 'web') {
        // Web platform - use localStorage
        if (typeof window !== 'undefined' && window.localStorage) {
          const value = localStorage.getItem(key);
          return Promise.resolve(value);
        } else {
          return Promise.resolve(null);
        }
      } else {
        // Mobile platforms - use expo-secure-store
        if (SecureStore && SecureStore.getItemAsync) {
          return await SecureStore.getItemAsync(key);
        } else {
          return null;
        }
      }
    } catch (error) {
      console.error(`Error retrieving item with key "${key}":`, error);
      return null;
    }
  },

  /**
   * Remove a key-value pair
   * @param {string} key - Storage key
   * @returns {Promise<void>}
   */
  removeItem: async (key) => {
    try {
      if (Platform.OS === 'web') {
        // Web platform - use localStorage
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.removeItem(key);
          return Promise.resolve();
        }
      } else {
        // Mobile platforms - use expo-secure-store
        if (SecureStore && SecureStore.deleteItemAsync) {
          return await SecureStore.deleteItemAsync(key);
        }
      }
    } catch (error) {
      console.error(`Error removing item with key "${key}":`, error);
      throw error;
    }
  },

  /**
   * Clear all stored data
   * @returns {Promise<void>}
   */
  clear: async () => {
    try {
      if (Platform.OS === 'web') {
        // Web platform - clear localStorage
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.clear();
          return Promise.resolve();
        }
      } else {
        // Mobile platforms - we'll need to track keys manually
        // or just remove the specific keys we use
        const keysToRemove = ['access_token', 'refresh_token', 'user_data'];
        for (const key of keysToRemove) {
          try {
            await storage.removeItem(key);
          } catch (error) {
            console.warn(`Failed to remove key "${key}":`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error clearing storage:', error);
      throw error;
    }
  },

  /**
   * Check if storage is available
   * @returns {boolean}
   */
  isAvailable: () => {
    if (Platform.OS === 'web') {
      return typeof window !== 'undefined' && !!window.localStorage;
    } else {
      return !!(SecureStore && SecureStore.setItemAsync && SecureStore.getItemAsync);
    }
  }
};

// Export individual methods for backward compatibility
export const setItemAsync = storage.setItem;
export const getItemAsync = storage.getItem;
export const deleteItemAsync = storage.removeItem;

export default storage;