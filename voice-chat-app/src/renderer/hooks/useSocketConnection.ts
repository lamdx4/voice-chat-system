import { useEffect } from 'react';
import { socketService } from '@/services/socket';
import { useUserStore } from '@/stores/userStore';
import { useVoiceChatStore } from '@/stores/voiceChatStore';

/**
 * Custom hook to manage socket connection at app level
 * This ensures socket persists across view changes
 */
export function useSocketConnection() {
  const userId = useUserStore((state) => state.userId);
  const name = useUserStore((state) => state.name);
  const isStoreReady = useUserStore((state) => state.isStoreReady);
  const isInitialized = useUserStore((state) => state.isInitialized);
  const isSocketConnected = useVoiceChatStore((state) => state.isSocketConnected);

  useEffect(() => {
    // Only connect when user is fully initialized
    if (!isInitialized || !isStoreReady) {
      console.log('⏳ Waiting for user initialization...');
      return;
    }

    // Validate user data
    if (!userId || !name || userId.trim() === '' || name.trim() === '') {
      console.log('⚠️ Invalid user data, cannot connect socket');
      return;
    }

    // Connect if not already connected
    if (!socketService.isConnected()) {
      console.log('🔌 [useSocketConnection] Connecting to server...', { 
        userId: userId.substring(0, 8) + '...', 
        name 
      });
      socketService.connect();
    } else {
      console.log('✅ [useSocketConnection] Socket already connected');
    }

    // Cleanup: only disconnect when user actually logs out
    // NOT when component unmounts
    return () => {
      console.log('🔄 [useSocketConnection] Cleanup - keeping socket connected');
      // Socket will be disconnected by explicit logout
    };
  }, [isInitialized, isStoreReady, userId, name]);

  // Handle reconnection if connection drops unexpectedly
  useEffect(() => {
    if (!isSocketConnected && isInitialized && userId && name) {
      const reconnectTimer = setTimeout(() => {
        console.log('🔄 Attempting to reconnect...');
        if (!socketService.isConnected()) {
          socketService.connect();
        }
      }, 2000);

      return () => clearTimeout(reconnectTimer);
    }
  }, [isSocketConnected, isInitialized, userId, name]);

  return {
    isConnected: isSocketConnected,
    connect: () => socketService.connect(),
    disconnect: () => socketService.disconnect(),
  };
}

