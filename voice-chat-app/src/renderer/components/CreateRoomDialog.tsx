import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '../../components/ui/checkbox';
import { useVoiceChatStore } from '@/stores/voiceChatStore';
import { useUserStore } from '@/stores/userStore';
import { socketService } from '@/services/socket';
import { UserStatus, RoomType } from '@/types';
import { Video, CheckCircle2 } from 'lucide-react';

interface CreateRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateRoomDialog({ open, onOpenChange }: CreateRoomDialogProps) {
  const [roomName, setRoomName] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);

  const onlineUsers = useVoiceChatStore((state) => state.onlineUsers);
  const currentUserId = useUserStore((state) => state.userId);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const toggleUser = (userId: string) => {
    setSelectedUserIds(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(userId)) {
        newSelected.delete(userId);
      } else {
        newSelected.add(userId);
      }
      return newSelected;
    });
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim()) return;

    setIsCreating(true);
    try {
      const response = await socketService.createRoom({
        roomType: RoomType.GROUP,
        roomName: roomName.trim(),
        invitedUserIds: selectedUserIds.size > 0 ? Array.from(selectedUserIds) : undefined,
      });

      if (response.success && response.room) {
        useVoiceChatStore.getState().setCurrentRoom(response.room);
        setRoomName('');
        setSelectedUserIds(new Set());
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Error creating room:', error);
    } finally {
      setIsCreating(false);
    }
  };

  // Filter out current user and users already in a call
  const availableUsers = onlineUsers.filter(user => 
    user.userId !== currentUserId
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center">
              <Video className="w-5 h-5 text-white" />
            </div>
            Create Group Call
          </DialogTitle>
          <DialogDescription>
            Enter room name and select users to invite
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreateRoom} className="space-y-4 mt-4">
          {/* Room Name Input */}
          <div className="space-y-2">
            <Label htmlFor="roomName" className="text-sm font-semibold">Room Name</Label>
            <Input
              id="roomName"
              type="text"
              placeholder="Enter room name..."
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              maxLength={50}
              required
              className="border-2 focus:border-orange-300"
            />
            <p className="text-xs text-muted-foreground">{roomName.length}/50 characters</p>
          </div>

          {/* User Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">
              Invite Users <span className="text-muted-foreground font-normal">(Optional)</span>
            </Label>
            <ScrollArea className="h-64 border-2 rounded-lg p-3">
              {availableUsers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No users available to invite</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {availableUsers.map((user) => (
                    <label
                      key={user.userId}
                      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all ${
                        selectedUserIds.has(user.userId)
                          ? 'bg-blue-50 border-2 border-blue-500'
                          : 'border-2 border-transparent hover:bg-gray-50'
                      }`}
                    >
                      <Checkbox
                        checked={selectedUserIds.has(user.userId)}
                        onCheckedChange={() => toggleUser(user.userId)}
                      />
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="bg-gradient-to-br from-blue-400 to-purple-400 text-white text-xs">
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium text-sm text-gray-900">{user.name}</p>
                        <Badge
                          variant={user.status === UserStatus.IDLE ? 'default' : 'secondary'}
                          className={`text-xs ${
                            user.status === UserStatus.IDLE
                              ? 'bg-green-500 hover:bg-green-600'
                              : 'bg-yellow-500 hover:bg-yellow-600'
                          }`}
                        >
                          {user.status === UserStatus.IDLE ? 'Available' : 'Busy'}
                        </Badge>
                      </div>
                      {selectedUserIds.has(user.userId) && (
                        <CheckCircle2 className="w-5 h-5 text-blue-500" />
                      )}
                    </label>
                  ))}
                </div>
              )}
            </ScrollArea>
            {selectedUserIds.size > 0 && (
              <p className="text-xs text-muted-foreground">
                {selectedUserIds.size} user{selectedUserIds.size !== 1 ? 's' : ''} selected - they will receive an invitation
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => {
                setRoomName('');
                setSelectedUserIds(new Set());
                onOpenChange(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600"
              disabled={!roomName.trim() || isCreating}
            >
              {isCreating ? 'Creating...' : 'Create Room'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

