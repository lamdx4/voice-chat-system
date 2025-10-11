import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useVoiceChatStore } from '@/stores/voiceChatStore';
import { socketService } from '@/services/socket';
import { Phone, PhoneOff } from 'lucide-react';
import { toast } from 'sonner';

// Create ringtone using Web Audio API
const createRingtone = () => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  let oscillator: OscillatorNode | null = null;
  let gainNode: GainNode | null = null;
  let intervalId: NodeJS.Timeout | null = null;

  const play = () => {
    // Stop if already playing
    stop();

    // Create oscillator for ringtone
    const playTone = () => {
      oscillator = audioContext.createOscillator();
      gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Ringtone pattern: two short beeps
      oscillator.frequency.value = 800; // Hz
      gainNode.gain.value = 0.3;
      oscillator.type = 'sine';
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.2);
      
      setTimeout(() => {
        oscillator = audioContext.createOscillator();
        gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        gainNode.gain.value = 0.3;
        oscillator.type = 'sine';
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.2);
      }, 300);
    };

    // Play pattern every 2 seconds
    playTone();
    intervalId = setInterval(playTone, 2000);
  };

  const stop = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    if (oscillator) {
      try {
        oscillator.stop();
      } catch (e) {
        // Already stopped
      }
      oscillator = null;
    }
    if (gainNode) {
      gainNode = null;
    }
  };

  return { play, stop };
};

export function IncomingCall() {
  // Support both direct calls (new) and group calls (old)
  const incomingCallNew = useVoiceChatStore((state) => state.incomingCallNew);
  const incomingCall = useVoiceChatStore((state) => state.incomingCall);
  const setIncomingCallNew = useVoiceChatStore((state) => state.setIncomingCallNew);
  const setIncomingCall = useVoiceChatStore((state) => state.setIncomingCall);
  const setCurrentRoom = useVoiceChatStore((state) => state.setCurrentRoom);
  const ringtoneRef = useRef<ReturnType<typeof createRingtone> | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Use whichever call is active
  const activeCall = incomingCallNew || incomingCall;
  const isDirectCall = !!incomingCallNew;

  // Debug log
  console.log('🔔 IncomingCall component render:', {
    hasIncomingCallNew: !!incomingCallNew,
    hasIncomingCall: !!incomingCall,
    hasActiveCall: !!activeCall,
    isDirectCall,
    callFrom: activeCall?.fromUserName,
  });

  useEffect(() => {
    if (activeCall) {
      console.log('📞 Incoming call from:', activeCall.fromUserName);
      
      // Safety check: If call is too old (> 60 seconds), auto-clear it
      // Only applies to direct calls which have receivedAt
      if ('receivedAt' in activeCall) {
        const callAge = Date.now() - activeCall.receivedAt;
        if (callAge > 60000) {
          console.warn('⚠️ Stale incoming call detected (age:', callAge, 'ms). Auto-clearing...');
          if (isDirectCall) {
            setIncomingCallNew(null);
          } else {
            setIncomingCall(null);
          }
          return;
        }
      }
      
      // Create and play ringtone
      if (!ringtoneRef.current) {
        ringtoneRef.current = createRingtone();
      }
      ringtoneRef.current.play();
    } else {
      // Stop ringtone when call ends
      if (ringtoneRef.current) {
        ringtoneRef.current.stop();
      }
    }

    // Cleanup on unmount
    return () => {
      if (ringtoneRef.current) {
        ringtoneRef.current.stop();
      }
    };
  }, [activeCall, isDirectCall, setIncomingCallNew, setIncomingCall]);

  const handleAccept = async () => {
    if (!activeCall || isProcessing) return;

    setIsProcessing(true);

    // Stop ringtone
    if (ringtoneRef.current) {
      ringtoneRef.current.stop();
    }

    if (isDirectCall && incomingCallNew) {
      // Direct call flow
      console.log('📞 Accepting direct call...', incomingCallNew.callId);
      
      // Clear incoming call IMMEDIATELY to dismiss dialog
      setIncomingCallNew(null);
      
      socketService.acceptCallNew(incomingCallNew.callId, async (response) => {
        if (!response.success) {
          console.error('❌ Failed to accept call:', response.error);
          toast.error(`Failed to accept: ${response.error}`);
          setIsProcessing(false);
          return;
        }

        console.log('✅ Call accepted, room created:', response.roomId);

        // Join the room
        const joinResponse = await socketService.joinRoom({
          roomId: response.roomId!,
        });

        if (!joinResponse.success || !joinResponse.room) {
          console.error('❌ Failed to join room:', joinResponse.error);
          toast.error(`Failed to join: ${joinResponse.error}`);
          setIsProcessing(false);
          return;
        }

        console.log('✅ Joined room successfully');
        setCurrentRoom(joinResponse.room);
        setIsProcessing(false);
      });
    } else if (incomingCall) {
      // Group call flow - just join the room
      console.log('📞 Accepting group call invitation for room:', incomingCall.roomId);

      const joinResponse = await socketService.joinRoom({
        roomId: incomingCall.roomId,
      });

      if (!joinResponse.success || !joinResponse.room) {
        console.error('❌ Failed to join room:', joinResponse.error);
        toast.error(`Failed to join: ${joinResponse.error}`);
        setIsProcessing(false);
        return;
      }

      console.log('✅ Joined group call successfully');
      setCurrentRoom(joinResponse.room);
      
      // Clear incoming call
      setIncomingCall(null);
      setIsProcessing(false);
    }
  };

  const handleReject = () => {
    if (!activeCall || isProcessing) return;

    setIsProcessing(true);

    // Stop ringtone
    if (ringtoneRef.current) {
      ringtoneRef.current.stop();
    }

    if (isDirectCall && incomingCallNew) {
      // Direct call flow
      console.log('❌ Rejecting direct call:', incomingCallNew.callId);
      
      // Clear dialog IMMEDIATELY
      setIncomingCallNew(null);
      
      socketService.rejectCallNew(incomingCallNew.callId, 'User declined', (response) => {
        if (response.success) {
          console.log('✅ Call rejected');
        }
        setIsProcessing(false);
      });
    } else if (incomingCall) {
      // Group call flow - just clear the invitation
      console.log('❌ Declining group call invitation for room:', incomingCall.roomId);
      
      setIncomingCall(null);
      setIsProcessing(false);
      toast.info('Call invitation declined');
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={!!activeCall}>
      <DialogContent 
        className="sm:max-w-md border-4 shadow-2xl"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 -z-10 rounded-lg" />
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">
            📞 {isDirectCall ? 'Incoming Call' : 'Group Call Invitation'}
          </DialogTitle>
          <DialogDescription className="text-center text-base">
            <span className="font-semibold">{activeCall?.fromUserName}</span> 
            {isDirectCall ? ' is calling you' : ' invited you to join'}
            {!isDirectCall && incomingCall?.roomName && (
              <div className="mt-1 text-sm text-gray-600">"{incomingCall.roomName}"</div>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-6 py-6">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-blue-500 rounded-full blur-xl opacity-50 animate-pulse" />
            <Avatar className="w-32 h-32 border-4 border-white shadow-2xl relative">
              <AvatarFallback className="text-3xl font-bold bg-gradient-to-br from-green-500 to-blue-500 text-white">
                {activeCall ? getInitials(activeCall.fromUserName) : ''}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-2 -right-2 w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center animate-bounce shadow-lg border-4 border-white">
              <Phone className="w-6 h-6 text-white" />
            </div>
          </div>

          <div className="text-center">
            <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {activeCall?.fromUserName}
            </h3>
            <p className="text-sm font-semibold text-muted-foreground mt-2 px-4 py-1 bg-white/60 rounded-full inline-block">
              {isDirectCall ? '💬 Direct Call' : '👥 Group Call'}
            </p>
          </div>

          <div className="flex gap-4 w-full pt-2">
            <Button
              variant="destructive"
              size="lg"
              className="flex-1 gap-2 shadow-lg hover:shadow-xl transition-all"
              onClick={handleReject}
              disabled={isProcessing}
            >
              <PhoneOff className="w-5 h-5" />
              Reject
            </Button>
            <Button
              size="lg"
              className="flex-1 gap-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-lg hover:shadow-xl transition-all"
              onClick={handleAccept}
              disabled={isProcessing}
            >
              <Phone className="w-5 h-5" />
              {isProcessing ? 'Accepting...' : 'Accept'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

