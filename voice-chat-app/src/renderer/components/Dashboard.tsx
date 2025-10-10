import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useVoiceChatStore } from '@/stores/voiceChatStore';
import { useUserStore } from '@/stores/userStore';
import { socketService } from '@/services/socket';
import { RoomList } from './RoomList';
import { OnlineUsers } from './OnlineUsers';
import { CreateRoomDialog } from './CreateRoomDialog';
import { LogOut, Wifi, WifiOff, Plus } from 'lucide-react';

export function Dashboard() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const isSocketConnected = useVoiceChatStore((state) => state.isSocketConnected);
  const currentUserName = useUserStore((state) => state.name);
  const reset = useUserStore((state) => state.reset);

  // Socket connection is now managed in App.tsx via useSocketConnection hook
  // Dashboard just displays the connection status

  const handleLogout = () => {
    // Disconnect and reset user data
    socketService.disconnect();
    reset();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <Card className="shadow-lg border-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">
                  Voice Chat Dashboard
                </CardTitle>
                <p className="text-muted-foreground mt-1">
                  Welcome back, <span className="font-semibold">{currentUserName}</span>!
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge
                  variant={isSocketConnected ? 'default' : 'destructive'}
                  className="gap-1"
                >
                  {isSocketConnected ? (
                    <>
                      <Wifi className="w-3 h-3" />
                      Connected
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-3 h-3" />
                      Disconnected
                    </>
                  )}
                </Badge>
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Create Room Button */}
            <Card className="shadow-lg border-2">
              <CardContent className="pt-6">
                <Button
                  onClick={() => setShowCreateDialog(true)}
                  className="w-full gap-2 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600"
                  size="lg"
                >
                  <Plus className="w-5 h-5" />
                  Create Group Call
                </Button>
              </CardContent>
            </Card>
            <RoomList />
          </div>

          {/* Right Column */}
          <div>
            <OnlineUsers />
          </div>
        </div>

        {/* Create Room Dialog */}
        <CreateRoomDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />

        {/* Footer Info */}
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Server</p>
                <p className="font-mono font-semibold">
                  {import.meta.env.VITE_SERVER_URL || 'http://localhost:3000'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Version</p>
                <p className="font-semibold">1.0.0</p>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <p className="font-semibold">
                  {isSocketConnected ? 'Online' : 'Offline'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}

