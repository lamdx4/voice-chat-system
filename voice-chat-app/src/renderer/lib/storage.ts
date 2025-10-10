/**
 * Storage Adapter
 * 
 * This provides a unified storage interface that works in both:
 * - Electron (using localStorage in renderer)
 * - Web browser (using localStorage)
 * 
 * For production Electron apps, consider using electron-store:
 * https://github.com/sindresorhus/electron-store
 */

interface StorageAdapter {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
}

class ElectronStorage implements StorageAdapter {
  private storage: Storage;

  constructor() {
    // Use localStorage in renderer process
    this.storage = window.localStorage;
  }

  getItem(key: string): string | null {
    try {
      return this.storage.getItem(key);
    } catch (error) {
      console.error('Storage getItem error:', error);
      return null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      this.storage.setItem(key, value);
    } catch (error) {
      console.error('Storage setItem error:', error);
    }
  }

  removeItem(key: string): void {
    try {
      this.storage.removeItem(key);
    } catch (error) {
      console.error('Storage removeItem error:', error);
    }
  }

  clear(): void {
    try {
      this.storage.clear();
    } catch (error) {
      console.error('Storage clear error:', error);
    }
  }

  // Helper methods
  getJSON<T>(key: string, defaultValue?: T): T | null {
    const value = this.getItem(key);
    if (!value) return defaultValue || null;
    
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      console.error('JSON parse error:', error);
      return defaultValue || null;
    }
  }

  setJSON<T>(key: string, value: T): void {
    try {
      this.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('JSON stringify error:', error);
    }
  }
}

// Export singleton
export const storage = new ElectronStorage();

// For Zustand persist
export const createZustandStorage = () => ({
  getItem: (name: string) => {
    const value = storage.getItem(name);
    return value ? JSON.parse(value) : null;
  },
  setItem: (name: string, value: unknown) => {
    storage.setItem(name, JSON.stringify(value));
  },
  removeItem: (name: string) => {
    storage.removeItem(name);
  },
});

/* 
 * 🚀 Production Upgrade Path:
 * 
 * 1. Install electron-store:
 *    yarn add electron-store
 * 
 * 2. Use in main process:
 *    const Store = require('electron-store');
 *    const store = new Store();
 * 
 * 3. Expose via IPC:
 *    ipcMain.handle('store-get', (_, key) => store.get(key));
 *    ipcMain.handle('store-set', (_, key, val) => store.set(key, val));
 * 
 * 4. Use in renderer:
 *    const value = await window.electron.store.get('key');
 */

