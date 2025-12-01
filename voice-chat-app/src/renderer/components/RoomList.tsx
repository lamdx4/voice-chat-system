import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useVoiceChatStore } from '@/stores/voiceChatStore';
import { socketService } from '@/services/socket';
import { webrtcService } from '@/lib/mediasoup';
import { Users, Video, UserPlus } from 'lucide-react';
import { RoomType } from '@/types';

export function RoomList() {
  const availableRooms = useVoiceChatStore((state) => state.availableRooms);

  const handleJoinRoom = async (roomId: string) => {
    const response = await socketService.joinRoom({ roomId });
    console.log('📥 RoomList joinRoom response:', {
      success: response.success,
      hasRoom: !!response.room,
      producersCount: response.existingProducers?.length || 0,
      producers: response.existingProducers
    });

    if (response.success && response.room) {
      useVoiceChatStore.getState().setCurrentRoom(response.room);

      // Consume existing producers from response
      if (response.existingProducers && response.existingProducers.length > 0) {
        console.log(`🎬 Consuming ${response.existingProducers.length} existing producers...`);
        for (const producer of response.existingProducers) {
          console.log(`  📦 Producer:`, producer);
          try {
            await webrtcService.consume(
              producer.producerId,
              producer.userId,
              producer.kind as 'audio' | 'video',
              producer.appData
            );
            console.log(`  ✅ Consumed ${producer.kind} from ${producer.userId}`);
          } catch (error) {
            console.error('❌ Failed to consume producer:', producer.producerId, error);
          }
        }
      } else {
        console.log('⚠️ No existing producers to consume');
      }
    }
  };

  const groupRooms = availableRooms.filter((room) => room.roomType === RoomType.GROUP);

  return (
    <Card className="shadow-lg border-2">
      <CardHeader className="bg-gradient-to-br from-purple-50 to-pink-50">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
              Available Rooms
            </CardTitle>
            <CardDescription className="mt-1">Join a group call</CardDescription>
          </div>
          <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-200">{groupRooms.length} rooms</Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {groupRooms.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <Video className="w-10 h-10 text-gray-400" />
            </div>
            <p className="font-medium">No rooms available</p>
            <p className="text-xs mt-1">Create a new room to get started</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-3">
              {groupRooms.map((room) => (
                <div
                  key={room.roomId}
                  className="flex items-center justify-between p-4 rounded-lg border-2 bg-white hover:bg-purple-50 hover:border-purple-200 transition-all shadow-sm"
                >
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg">{room.roomName}</h4>
                    <div className="flex items-center gap-3 mt-1.5">
                      <p className="text-sm text-muted-foreground">
                        Host: <span className="font-medium text-gray-700">{room.hostName}</span>
                      </p>
                      <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">
                        <Users className="w-3 h-3 mr-1" />
                        {room.participants.length} joined
                      </Badge>
                    </div>
                  </div>
                  <Button onClick={() => handleJoinRoom(room.roomId)} size="sm" className="gap-1">
                    <UserPlus className="w-4 h-4" />
                    Join
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

