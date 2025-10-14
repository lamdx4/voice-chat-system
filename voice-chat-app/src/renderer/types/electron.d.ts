// Electron API type definitions

export interface ElectronStore {
  get: (key: string) => Promise<any>;
  set: (key: string, value: any) => Promise<boolean>;
  delete: (key: string) => Promise<boolean>;
  clear: () => Promise<boolean>;
  has: (key: string) => Promise<boolean>;
}

export interface ElectronAPI {
  store: ElectronStore;
  notifyIncomingCall: (callerName: string, callType: 'direct' | 'group') => void;
  showWindow: () => void;
}

export interface Versions {
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

export {};

