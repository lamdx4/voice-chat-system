import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useUserStore } from '@/stores/userStore';
import { useVoiceChatStore } from '@/stores/voiceChatStore';
import { socketService } from '@/services/socket';

export function DebugPanel() {
  const userStore = useUserStore();
  const voiceChatStore = useVoiceChatStore();
  const [, setTick] = useState(0);

  useEffect(() => {
    // Force re-render every second
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleConnect = () => {
    console.log('🔄 Manual connect triggered');
    socketService.connect();
  };

  return (
    <Card className="fixed bottom-4 right-4 w-96 max-h-96 overflow-auto z-50">
      <CardHeader>
        <CardTitle className="text-sm flex items-center justify-between">
          🐛 Debug Panel
          <Badge variant={userStore.isStoreReady ? 'default' : 'destructive'}>
            {userStore.isStoreReady ? 'Ready' : 'Loading'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="text-xs space-y-2">
        {/* User Store */}
        <div>
          <p className="font-bold">👤 User Store:</p>
          <div className="ml-2 space-y-1">
            <p>userId: {userStore.userId ? `${userStore.userId.substring(0, 8)}...` : '❌ empty'}</p>
            <p>name: {userStore.name || '❌ empty'}</p>
            <p>isInitialized: {userStore.isInitialized ? '✅' : '❌'}</p>
            <p>isStoreReady: {userStore.isStoreReady ? '✅' : '⏳'}</p>
          </div>
        </div>

        {/* Socket */}
        <div>
          <p className="font-bold">🔌 Socket:</p>
          <div className="ml-2 space-y-1">
            <p>isConnected: {voiceChatStore.isSocketConnected ? '✅' : '❌'}</p>
            <p>socket.connected: {socketService.isConnected() ? '✅' : '❌'}</p>
          </div>
        </div>

        {/* Electron API */}
        <div>
          <p className="font-bold">⚡ Electron:</p>
          <div className="ml-2">
            <p>electronAPI: {window.electronAPI ? '✅' : '❌'}</p>
          </div>
        </div>

        {/* Manual Actions */}
        <div className="pt-2 border-t">
          <button 
            onClick={handleConnect}
            className="w-full px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            🔄 Force Connect
          </button>
        </div>

        {/* Console Tip */}
        <div className="pt-2 border-t text-muted-foreground">
          <p>💡 Check Console (F12) for logs</p>
        </div>
      </CardContent>
    </Card>
  );
}

