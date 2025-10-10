/// <reference types="vite/client" />

// Environment Variables
interface ImportMetaEnv {
  readonly VITE_SERVER_URL: string;
  readonly VITE_SERVER_WS_URL: string;
  readonly VITE_DEV_SERVER_URL: string;
  readonly VITE_DEV_SERVER_WS_URL: string;
  readonly MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Electron API type definitions
interface ElectronStore {
  get: (key: string) => Promise<any>;
  set: (key: string, value: any) => Promise<boolean>;
  delete: (key: string) => Promise<boolean>;
  clear: () => Promise<boolean>;
  has: (key: string) => Promise<boolean>;
}

interface ElectronAPI {
  store: ElectronStore;
}

interface Versions {
  node: () => string;
  chrome: () => string;
  electron: () => string;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    versions: Versions;
  }
}

