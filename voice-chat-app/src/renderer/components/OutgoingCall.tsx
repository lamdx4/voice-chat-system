import { useEffect, useState } from 'react';
import { Phone, PhoneOff } from 'lucide-react';
import { useVoiceChatStore } from '../stores/voiceChatStore';
import { socketService } from '../services/socket';
import { audioService } from '../services/audioService';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Avatar, AvatarFallback } from './ui/avatar';
import { toast } from 'sonner';

export default function OutgoingCall() {
  const outgoingCall = useVoiceChatStore((state) => state.outgoingCall);
  const setOutgoingCall = useVoiceChatStore((state) => state.setOutgoingCall);
  const clearCallTimeout = useVoiceChatStore((state) => state.clearCallTimeout);

  const [secondsElapsed, setSecondsElapsed] = useState(0);

  // Play/stop outgoing call sound
  useEffect(() => {
    if (outgoingCall) {
      audioService.playOutgoingCallSound();
    } else {
      audioService.stopOutgoingCallSound();
    }

    return () => {
      audioService.stopOutgoingCallSound();
    };
  }, [outgoingCall]);

  // Update elapsed time
  useEffect(() => {
    if (!outgoingCall) {
      setSecondsElapsed(0);
      return;
    }

    // Update elapsed time every second
    const interval = setInterval(() => {
      setSecondsElapsed(Math.floor((Date.now() - outgoingCall.startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [outgoingCall]);

  const handleCancel = () => {
    if (!outgoingCall) return;

    console.log(`🚫 Cancelling call ${outgoingCall.callId}`);

    // Stop outgoing sound
    audioService.stopOutgoingCallSound();

    // Clear timeout
    clearCallTimeout();

    // Emit cancel event
    socketService.cancelCall(outgoingCall.callId, (response) => {
      if (response.success) {
        console.log('✅ Call cancelled successfully');
      } else {
        console.error('❌ Failed to cancel call:', response.error);
        toast.error(`Failed to cancel: ${response.error}`);
      }
    });

    // Clear state
    setOutgoingCall(null);
  };

  if (!outgoingCall) return null;

  const initials = outgoingCall.targetUserName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Dialog open={!!outgoingCall} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="sm:max-w-md bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30 border-0 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Calling...
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center py-8 space-y-6">
          {/* Avatar with pulsing animation */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-ping opacity-20" />
            <Avatar className="h-24 w-24 border-4 border-white shadow-xl">
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-2xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* User name */}
          <div className="text-center">
            <h3 className="text-xl font-semibold text-gray-900">
              {outgoingCall.targetUserName}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {secondsElapsed < 30 ? `${30 - secondsElapsed}s remaining...` : 'Connecting...'}
            </p>
          </div>

          {/* Ringing icon animation */}
          <div className="flex items-center justify-center space-x-2">
            <div className="animate-bounce">
              <Phone className="h-6 w-6 text-blue-600" />
            </div>
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse delay-75" />
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse delay-150" />
            </div>
          </div>

          {/* Cancel button */}
          <Button
            onClick={handleCancel}
            variant="destructive"
            size="lg"
            className="w-full bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white shadow-lg"
          >
            <PhoneOff className="h-5 w-5 mr-2" />
            Cancel Call
          </Button>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-1000"
            style={{ width: `${(secondsElapsed / 30) * 100}%` }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

