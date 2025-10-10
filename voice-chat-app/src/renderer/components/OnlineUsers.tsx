import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useVoiceChatStore } from '@/stores/voiceChatStore';
import { useUserStore } from '@/stores/userStore';
import { socketService } from '@/services/socket';
import { UserCircle, Phone } from 'lucide-react';
import { UserStatus } from '@/types';
import { toast } from 'sonner';

export function OnlineUsers() {
  const onlineUsers = useVoiceChatStore((state) => state.onlineUsers);
  const currentUserId = useUserStore((state) => state.userId);
  const setOutgoingCall = useVoiceChatStore((state) => state.setOutgoingCall);
  const setCallTimeout = useVoiceChatStore((state) => state.setCallTimeout);

  const handleDirectCall = (targetUserId: string, targetUserName: string) => {
    console.log('📞 Calling user:', targetUserId);

    // Generate unique call ID
    const callId = `${currentUserId}-${targetUserId}-${Date.now()}`;

    // Emit call event
    socketService.callUser(callId, targetUserId, (response) => {
      if (!response.success) {
        console.error('❌ Call failed:', response.error);
        toast.error(response.error || 'Failed to initiate call');
        
        if (response.canRetry) {
          toast.info('You can try calling again in a moment');
        }
        return;
      }

      console.log('✅ Call initiated successfully');

      // Set outgoing call state
      setOutgoingCall({
        callId,
        targetUserId,
        targetUserName,
        startTime: Date.now(),
      });

      // Start 30 second timeout
      const timeoutId = setTimeout(() => {
        console.log('⏱️ Call timeout - cancelling');
        
        // Emit cancel event
        socketService.cancelCall(callId, (cancelResponse) => {
          if (cancelResponse.success) {
            console.log('✅ Call cancelled due to timeout');
          }
        });

        // Clear state
        setOutgoingCall(null);
        toast.error('No answer - call timed out');
      }, 30000);

      setCallTimeout(timeoutId);
    });
  };

  const otherUsers = onlineUsers.filter((user) => user.userId !== currentUserId);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card className="shadow-lg border-2">
      <CardHeader className="bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-500 to-blue-500 flex items-center justify-center">
                <UserCircle className="w-5 h-5 text-white" />
              </div>
              Online Users In LAN Network
            </CardTitle>
            <CardDescription className="mt-1">Call someone directly</CardDescription>
          </div>
          <Badge className="bg-green-100 text-green-700 hover:bg-green-200">{otherUsers.length} online</Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {otherUsers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <UserCircle className="w-10 h-10 text-gray-400" />
            </div>
            <p className="font-medium">No other users online</p>
            <p className="text-xs mt-1">Waiting for someone to join...</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-2">
              {otherUsers.map((user) => (
                <div
                  key={user.userId}
                  className="flex items-center justify-between p-3 rounded-lg border-2 bg-white hover:bg-blue-50 hover:border-blue-200 transition-all shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10 border-2 border-blue-200">
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white font-semibold">
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h4 className="font-semibold">{user.name}</h4>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className={`w-2 h-2 rounded-full ${user.status === UserStatus.IN_CALL ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
                        <span className="text-xs font-medium text-muted-foreground">
                          {user.status === UserStatus.IN_CALL ? 'In call' : 'Available'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleDirectCall(user.userId, user.name)}
                    size="sm"
                    variant={user.status === UserStatus.IN_CALL ? "outline" : "default"}
                    disabled={user.status === UserStatus.IN_CALL}
                    className="gap-1"
                  >
                    <Phone className="w-4 h-4" />
                    {user.status === UserStatus.IN_CALL ? 'Busy' : 'Call'}
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

