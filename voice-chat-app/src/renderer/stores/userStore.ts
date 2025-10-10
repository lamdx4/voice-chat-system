import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

interface UserState {
  userId: string;
  name: string;
  isInitialized: boolean;
  isStoreReady: boolean;  // Track if store is loaded
  
  // Settings
  preferredInputDevice: string | null;
  preferredOutputDevice: string | null;
  
  // Actions
  initializeUser: (name: string) => void;
  updateName: (name: string) => void;
  setPreferredInputDevice: (deviceId: string) => void;
  setPreferredOutputDevice: (deviceId: string) => void;
  reset: () => void;
  
  // Internal
  _loadFromStore: () => Promise<void>;
  _saveToStore: () => Promise<void>;
}

const STORE_KEY = 'user-data';

// Custom electron-store persistence
const createElectronStorePersistence = () => {
  const storage = {
    async get(key: string) {
      if (typeof window !== 'undefined' && window.electronAPI) {
        try {
          const data = await window.electronAPI.store.get(key);
          return data || null;
        } catch (error) {
          console.error('Error loading from electron-store:', error);
          return null;
        }
      }
      return null;
    },
    
    async set(key: string, value: any) {
      if (typeof window !== 'undefined' && window.electronAPI) {
        try {
          await window.electronAPI.store.set(key, value);
        } catch (error) {
          console.error('Error saving to electron-store:', error);
        }
      }
    },
    
    async delete(key: string) {
      if (typeof window !== 'undefined' && window.electronAPI) {
        try {
          await window.electronAPI.store.delete(key);
        } catch (error) {
          console.error('Error deleting from electron-store:', error);
        }
      }
    },
  };
  
  return storage;
};

const storage = createElectronStorePersistence();

// Get or create userId
const getOrCreateUserId = async (): Promise<string> => {
  const stored = await storage.get(STORE_KEY);
  if (stored?.userId) {
    console.log('📦 Loaded existing userId from electron-store:', stored.userId);
    return stored.userId;
  }
  
  const newId = uuidv4();
  console.log('🆕 Generated new userId:', newId);
  return newId;
};

// Initialize state asynchronously
const initializeState = async () => {
  const stored = await storage.get(STORE_KEY);
  const userId = await getOrCreateUserId();
  
  return {
    userId,
    name: stored?.name || '',
    isInitialized: stored?.isInitialized || false,
    isStoreReady: true,  // Mark as ready
    preferredInputDevice: stored?.preferredInputDevice || null,
    preferredOutputDevice: stored?.preferredOutputDevice || null,
  };
};

const initialState = {
  userId: '', // Will be set asynchronously
  name: '',
  isInitialized: false,
  isStoreReady: false,  // Not ready initially
  preferredInputDevice: null,
  preferredOutputDevice: null,
};

export const useUserStore = create<UserState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      initializeUser: async (name: string) => {
        set({ name, isInitialized: true });
        await get()._saveToStore();
      },

      updateName: async (name: string) => {
        set({ name });
        await get()._saveToStore();
      },

      setPreferredInputDevice: async (deviceId: string) => {
        set({ preferredInputDevice: deviceId });
        await get()._saveToStore();
      },

      setPreferredOutputDevice: async (deviceId: string) => {
        set({ preferredOutputDevice: deviceId });
        await get()._saveToStore();
      },

      reset: async () => {
        const newUserId = uuidv4();
        console.log('🔄 Reset with new userId:', newUserId);
        set({ 
          userId: newUserId,
          name: '',
          isInitialized: false,
          preferredInputDevice: null,
          preferredOutputDevice: null,
        });
        await storage.delete(STORE_KEY);
        await get()._saveToStore();
      },
      
      // Internal methods
      _loadFromStore: async () => {
        const state = await initializeState();
        set(state);
        console.log('✅ User store loaded from electron-store');
      },
      
      _saveToStore: async () => {
        const state = get();
        await storage.set(STORE_KEY, {
          userId: state.userId,
          name: state.name,
          isInitialized: state.isInitialized,
          preferredInputDevice: state.preferredInputDevice,
          preferredOutputDevice: state.preferredOutputDevice,
        });
      },
    }),
    { name: 'UserStore' }
  )
);

// Initialize store on load
if (typeof window !== 'undefined') {
  useUserStore.getState()._loadFromStore();
}
