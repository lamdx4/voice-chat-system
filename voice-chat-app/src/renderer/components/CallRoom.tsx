import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useVoiceChatStore } from '@/stores/voiceChatStore';
import { useUserStore } from '@/stores/userStore';
import { socketService } from '@/services/socket';
import { webrtcService } from '@/lib/mediasoup';
import { RoomType, ChatMessage } from '@/types';
import { ResizableSidePanel } from './ResizableSidePanel';
import { ParticipantGrid } from './ParticipantGrid';
import { ParticipantSidebar } from './ParticipantSidebar';
import { DeviceSelector } from './DeviceSelector';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  MessageSquare,
  Users,
} from 'lucide-react';

export function CallRoom() {
  const currentRoom = useVoiceChatStore((state) => state.currentRoom);
  const participants = useVoiceChatStore((state) => state.participants);
  const messages = useVoiceChatStore((state) => state.messages);
  const isMuted = useVoiceChatStore((state) => state.isMuted);
  const isVideoEnabled = useVoiceChatStore((state) => state.isVideoEnabled);
  const localAudioTrack = useVoiceChatStore((state) => state.localAudioTrack);
  const localVideoTrack = useVoiceChatStore((state) => state.localVideoTrack);
  const setMuted = useVoiceChatStore((state) => state.setMuted);
  const setVideoEnabled = useVoiceChatStore((state) => state.setVideoEnabled);
  const leaveRoom = useVoiceChatStore((state) => state.leaveRoom);
  
  const currentUserId = useUserStore((state) => state.userId);
  const currentUserName = useUserStore((state) => state.name);

  const [showChat, setShowChat] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const initializeCall = useCallback(async () => {
    if (!currentRoom) {
      console.log('⚠️ No current room, aborting initialization');
      return;
    }

    try {
      console.log('🚀 Initializing call for room:', currentRoom.roomId);
      
      // Initialize WebRTC device
      console.log('📡 Step 1: Initialize mediasoup device...');
      await webrtcService.initializeDevice(currentRoom.roomId);
      console.log('✅ Device initialized');
      
      // Create transports
      console.log('🚂 Step 2: Create send transport...');
      await webrtcService.createSendTransport(currentRoom.roomId);
      console.log('✅ Send transport created');
      
      console.log('🚃 Step 3: Create receive transport...');
      await webrtcService.createRecvTransport(currentRoom.roomId);
      console.log('✅ Receive transport created');
      
      // Get user media
      console.log('🎤 Step 4: Get user media (audio)...');
      const stream = await webrtcService.getUserMedia(true, false);
      console.log('✅ Got media stream:', stream.getTracks());
      
      // Produce audio
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        console.log('🎙️ Step 5: Produce audio track...');
        await webrtcService.produce(audioTrack);
        console.log('✅ Audio produced');
      } else {
        console.warn('⚠️ No audio track found in stream');
      }

      setIsInitialized(true);
      console.log('✅✅✅ Call initialized successfully');
      
      // Consume any producers that were queued while we were initializing
      console.log('🔄 Consuming pending producers...');
      await webrtcService.consumePendingProducers();
    } catch (error) {
      console.error('❌ Error initializing call:', error);
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack');
    }
  }, [currentRoom]);

  const cleanup = useCallback(async () => {
    console.log('🧹 Cleaning up WebRTC...');
    await webrtcService.cleanup();
    setIsInitialized(false);
  }, []);

  useEffect(() => {
    // Socket is managed at App level, so it's always connected here
    console.log('🔄 CallRoom useEffect:', { 
      hasRoom: !!currentRoom, 
      isInitialized, 
      roomId: currentRoom?.roomId 
    });
    
    if (currentRoom && !isInitialized) {
      console.log('🎬 Starting call initialization...');
      initializeCall();
    }

    return () => {
      if (isInitialized) {
        console.log('🧹 Cleaning up call...');
        cleanup();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRoom?.roomId, isInitialized]);

  useEffect(() => {
    // Auto scroll chat to bottom
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleToggleMute = async () => {
    const newMuted = !isMuted;
    webrtcService.muteAudio(newMuted);
    setMuted(newMuted);
    
    // Broadcast media state to other participants
    if (currentRoom) {
      await socketService.updateMediaState(currentRoom.roomId, newMuted, isVideoEnabled);
    }
  };

  const handleToggleVideo = async () => {
    const newVideoEnabled = !isVideoEnabled;
    
    try {
      if (newVideoEnabled) {
        // Start or resume video
        await webrtcService.resumeOrStartVideo();
      } else {
        // Stop video completely (stop track and close producer)
        await webrtcService.stopVideo();
      }
      
      setVideoEnabled(newVideoEnabled);
      
      // Broadcast media state to other participants
      if (currentRoom) {
        await socketService.updateMediaState(currentRoom.roomId, isMuted, newVideoEnabled);
      }
    } catch (error) {
      console.error('Error toggling video:', error);
      // Revert state on error
      setVideoEnabled(!newVideoEnabled);
    }
  };

  const handleLeaveCall = async () => {
    if (!currentRoom) return;

    await socketService.leaveRoom({ roomId: currentRoom.roomId });
    await cleanup();
    leaveRoom();
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !currentRoom) return;

    await socketService.sendMessage({
      roomId: currentRoom.roomId,
      content: messageInput.trim(),
      replyTo: replyingTo ? {
        messageId: replyingTo.messageId,
        userName: replyingTo.userName,
        content: replyingTo.content,
      } : undefined,
    });

    setMessageInput('');
    setReplyingTo(null);
  };

  const handleReply = (message: ChatMessage) => {
    setReplyingTo(message);
  };

  const handleReact = async (messageId: string, emoji: string) => {
    if (!currentRoom) return;
    await socketService.reactToMessage({
      roomId: currentRoom.roomId,
      messageId,
      emoji,
    });
  };

  const handleMicrophoneChange = async (deviceId: string | null) => {
    try {
      console.log('🎤 Changing microphone device:', deviceId);
      await webrtcService.switchMicrophone(deviceId);
    } catch (error) {
      console.error('❌ Failed to switch microphone:', error);
      // TODO: Show toast notification to user
    }
  };

  const handleSpeakerChange = async (deviceId: string | null) => {
    try {
      console.log('🔊 Changing speaker device:', deviceId);
      // No action needed here - the audioDeviceService handles it automatically
      // and ParticipantCard components will apply the new device
    } catch (error) {
      console.error('❌ Failed to switch speaker:', error);
      // TODO: Show toast notification to user
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!currentRoom) return null;

  const participantArray = Array.from(participants.values());

  console.log('📊 CallRoom - Current room:', currentRoom);
  console.log('📊 CallRoom - Participants from store:', participants);
  console.log('📊 CallRoom - Participant array:', participantArray);

  // Get all participants including self
  const allParticipants = [
    // Add current user
    {
      userId: currentUserId,
      name: currentUserName,
      isLocal: true,
      isMuted,
      isVideoEnabled,
      audioTrack: localAudioTrack || undefined,
      videoTrack: localVideoTrack || undefined,
    },
    // Add remote participants
    ...participantArray.filter((p) => p.userId !== currentUserId).map(p => ({
      userId: p.userId,
      name: p.name,
      isLocal: false,
      isMuted: p.isMuted ?? false,
      isVideoEnabled: p.isVideoEnabled ?? false,
      audioTrack: p.audioTrack,
      videoTrack: p.videoTrack,
    }))
  ];

  const isDirectCall = currentRoom.roomType === RoomType.DIRECT;

  // Render different layouts for direct vs group calls
  if (isDirectCall) {
    return <DirectCallLayout 
      allParticipants={allParticipants}
      currentUserId={currentUserId}
      currentUserName={currentUserName}
      isMuted={isMuted}
      isVideoEnabled={isVideoEnabled}
      localAudioTrack={localAudioTrack}
      localVideoTrack={localVideoTrack}
      messages={messages}
      messageInput={messageInput}
      setMessageInput={setMessageInput}
      handleSendMessage={handleSendMessage}
      handleToggleMute={handleToggleMute}
      handleToggleVideo={handleToggleVideo}
      handleReply={handleReply}
      handleReact={handleReact}
      replyingTo={replyingTo}
      setReplyingTo={setReplyingTo}
      handleLeaveCall={handleLeaveCall}
      handleMicrophoneChange={handleMicrophoneChange}
      handleSpeakerChange={handleSpeakerChange}
      messagesEndRef={messagesEndRef}
      formatTime={formatTime}
      getInitials={getInitials}
    />;
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      <div className="h-full flex">
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="h-16 border-b bg-white/80 backdrop-blur-sm px-6 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="font-semibold text-lg">{currentRoom.roomName}</h2>
                  <p className="text-sm text-muted-foreground">Group Call</p>
                </div>
              </div>
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                {allParticipants.length} participants
              </Badge>
            </div>
            <Button
              variant={showChat ? "default" : "outline"}
              size="sm"
              onClick={() => setShowChat(!showChat)}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Chat
            </Button>
          </div>

          {/* Video Area */}
          <div className="flex-1 overflow-hidden">
            <ParticipantGrid
              participants={allParticipants}
              isMuted={isMuted}
              isVideoEnabled={isVideoEnabled}
            />
          </div>

          {/* Bottom Controls */}
          <div className="h-20 border-t bg-white/80 backdrop-blur-sm shadow-lg">
            <div className="h-full max-w-4xl mx-auto px-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="w-9 h-9 border-2 border-blue-500">
                  <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold">
                    {getInitials(currentUserName)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">{currentUserName}</span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant={isMuted ? 'destructive' : 'outline'}
                  size="lg"
                  onClick={handleToggleMute}
                  className="gap-2"
                >
                  {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  {isMuted ? 'Unmute' : 'Mute'}
                </Button>

                <Button
                  variant={isVideoEnabled ? 'outline' : 'secondary'}
                  size="lg"
                  onClick={handleToggleVideo}
                  className="gap-2"
                >
                  {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                  {isVideoEnabled ? 'Stop Video' : 'Start Video'}
                </Button>

                <DeviceSelector
                  onMicrophoneChange={handleMicrophoneChange}
                  onSpeakerChange={handleSpeakerChange}
                  disabled={!currentRoom}
                />

                <Separator orientation="vertical" className="h-8" />

                <Button 
                  variant="destructive" 
                  size="lg" 
                  onClick={handleLeaveCall}
                  className="gap-2"
                >
                  <PhoneOff className="w-5 h-5" />
                  Leave
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar - Participants (when chat is closed) */}
        {!showChat && (
          <ParticipantSidebar
            participants={allParticipants}
            isMuted={isMuted}
            getInitials={getInitials}
          />
        )}

        {/* Resizable Side Panel Chat for Group Call */}
        {showChat && (
          <ResizableSidePanel
            messages={messages}
            messageInput={messageInput}
            setMessageInput={setMessageInput}
            handleSendMessage={handleSendMessage}
            currentUserId={currentUserId}
            messagesEndRef={messagesEndRef}
            formatTime={formatTime}
            getInitials={getInitials}
            onReply={handleReply}
            onReact={handleReact}
            replyingTo={replyingTo}
            onCancelReply={() => setReplyingTo(null)}
            onClose={() => setShowChat(false)}
          />
        )}
      </div>
    </div>
  );

  function getInitials(name: string) {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
}

// Direct Call Layout - Messaging style for 1-on-1 calls
function DirectCallLayout({ 
  allParticipants, 
  currentUserId,
  currentUserName,
  isMuted, 
  isVideoEnabled,
  localAudioTrack,
  localVideoTrack,
  messages,
  messageInput,
  setMessageInput,
  handleSendMessage,
  handleToggleMute,
  handleToggleVideo,
  handleLeaveCall,
  handleMicrophoneChange,
  handleSpeakerChange,
  handleReply,
  handleReact,
  replyingTo,
  setReplyingTo,
  messagesEndRef,
  formatTime,
  getInitials,
}: any) {
  const [showChat, setShowChat] = useState(false);
  const localUser = allParticipants.find((p: any) => p.isLocal);
  const remoteUser = allParticipants.find((p: any) => !p.isLocal);

  // Debug logging
  useEffect(() => {
    console.log('🎬 DirectCallLayout - All participants:', allParticipants);
    console.log('👤 Local user:', localUser);
    console.log('👥 Remote user:', remoteUser);
    if (remoteUser) {
      console.log('🔍 Remote user audioTrack:', remoteUser.audioTrack);
      console.log('🔍 Remote user videoTrack:', remoteUser.videoTrack);
    }
  }, [allParticipants, localUser, remoteUser]);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="h-16 bg-white border-b shadow-sm px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10 border-2 border-blue-500">
              <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold">
                {getInitials(remoteUser?.name || '')}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="font-semibold text-lg">{remoteUser?.name || 'Connecting...'}</h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span>In call</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={showChat ? "default" : "outline"}
              size="sm"
              onClick={() => setShowChat(!showChat)}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Chat
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Video Area - 2 columns for direct call */}
          <div className="flex-1 flex gap-4 p-6">
            {/* Remote User */}
            <Card className="flex-1 shadow-lg">
              <CardContent className="p-0 h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
                <ParticipantCard
                  name={remoteUser?.name || 'Connecting...'}
                  isLocal={false}
                  isMuted={remoteUser?.isMuted}
                  isVideoEnabled={remoteUser?.isVideoEnabled}
                  audioTrack={remoteUser?.audioTrack}
                  videoTrack={remoteUser?.videoTrack}
                />
              </CardContent>
            </Card>

            {/* Local User (You) */}
            <Card className="flex-1 shadow-lg">
              <CardContent className="p-0 h-full flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50">
                <ParticipantCard
                  name={localUser?.name || currentUserName}
                  isLocal={true}
                  isMuted={isMuted}
                  isVideoEnabled={isVideoEnabled}
                  audioTrack={localAudioTrack || undefined}
                  videoTrack={localVideoTrack || undefined}
                />
              </CardContent>
            </Card>
          </div>

          {/* Resizable Side Panel Chat */}
          {showChat && (
            <ResizableSidePanel
              messages={messages}
              messageInput={messageInput}
              setMessageInput={setMessageInput}
              handleSendMessage={handleSendMessage}
              currentUserId={currentUserId}
              messagesEndRef={messagesEndRef}
              formatTime={formatTime}
              getInitials={getInitials}
              onClose={() => setShowChat(false)}
              onReply={handleReply}
              onReact={handleReact}
              replyingTo={replyingTo}
              onCancelReply={() => setReplyingTo(null)}
            />
          )}
        </div>

        {/* Bottom Controls */}
        <div className="h-20 bg-white border-t shadow-lg">
          <div className="h-full max-w-4xl mx-auto px-6 flex items-center justify-center gap-3">
            <Button
              variant={isMuted ? "destructive" : "outline"}
              size="lg"
              onClick={handleToggleMute}
              className="gap-2"
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              {isMuted ? 'Unmute' : 'Mute'}
            </Button>

            <Button
              variant={isVideoEnabled ? "outline" : "secondary"}
              size="lg"
              onClick={handleToggleVideo}
              className="gap-2"
            >
              {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              {isVideoEnabled ? 'Stop Video' : 'Start Video'}
            </Button>

            <DeviceSelector
              onMicrophoneChange={handleMicrophoneChange}
              onSpeakerChange={handleSpeakerChange}
              disabled={false}
            />

            <Separator orientation="vertical" className="h-8" />

            <Button 
              variant="destructive" 
              size="lg" 
              onClick={handleLeaveCall}
              className="gap-2"
            >
              <PhoneOff className="w-5 h-5" />
              Leave Call
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Participant Card Component
interface ParticipantCardProps {
  name: string;
  isLocal?: boolean;
  isMuted?: boolean;
  isVideoEnabled?: boolean;
  audioTrack?: MediaStreamTrack;
  videoTrack?: MediaStreamTrack;
}

const ParticipantCard = React.memo(({
  name,
  isLocal = false,
  isMuted = false,
  isVideoEnabled = false,
  audioTrack,
  videoTrack,
}: ParticipantCardProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const monitorIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    console.log(`🎥 ParticipantCard ${name} - videoTrack:`, videoTrack);
    if (videoRef.current && videoTrack) {
      const stream = new MediaStream([videoTrack]);
      videoRef.current.srcObject = stream;
      console.log(`✅ Video track attached for ${name}`);
      
      // Explicitly play video (autoplay may not work)
      videoRef.current.play().then(() => {
        console.log(`✅ Video playing for ${name}`);
        console.log(`  📊 Video state - paused: ${videoRef.current?.paused}, readyState: ${videoRef.current?.readyState}`);
      }).catch(err => {
        console.error(`❌ Error playing video for ${name}:`, err);
      });
    }
  }, [videoTrack, name]);

  useEffect(() => {
    console.log(`🎙️ ParticipantCard ${name} - audioTrack:`, audioTrack, 'isLocal:', isLocal);
    
    // Cleanup previous audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    if (audioRef.current && audioTrack && !isLocal) {
      const stream = new MediaStream([audioTrack]);
      audioRef.current.srcObject = stream;
      audioRef.current.volume = 1.0; // Max volume
      audioRef.current.muted = false; // Ensure not muted
      console.log(`🔊 Audio element - volume: ${audioRef.current.volume}, muted: ${audioRef.current.muted}`);
      console.log(`  📊 Stream tracks:`, stream.getTracks().map(t => ({kind: t.kind, enabled: t.enabled, readyState: t.readyState})));
      
      audioRef.current.play().then(async () => {
        console.log(`✅ Audio playing for ${name}`);
        console.log(`  📊 Audio state - paused: ${audioRef.current?.paused}, volume: ${audioRef.current?.volume}, readyState: ${audioRef.current?.readyState}`);
        
        // Check if audio is actually playing by monitoring audio levels
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        
        console.log(`  📊 AudioContext state: ${audioContext.state}`);
        
        // Resume AudioContext if suspended (autoplay policy)
        if (audioContext.state === 'suspended') {
          console.log(`  ▶️ Resuming suspended AudioContext...`);
          await audioContext.resume();
          console.log(`  ✅ AudioContext resumed, new state: ${audioContext.state}`);
        }
        
        const source = audioContext.createMediaStreamSource(stream);
        const analyzer = audioContext.createAnalyser();
        analyzer.fftSize = 256;
        source.connect(analyzer);
        
        // IMPORTANT: Also connect to destination to ensure audio plays
        source.connect(audioContext.destination);
        console.log(`🔊 Audio routed to speakers via Web Audio API for ${name}`);
        
        const dataArray = new Uint8Array(analyzer.frequencyBinCount);
        let checkCount = 0;
        
        const checkAudio = () => {
          checkCount++;
          analyzer.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          const max = Math.max(...dataArray);
          
          // Also check track state
          const track = stream.getAudioTracks()[0];
          console.log(`📊 [Check ${checkCount}] Track state: enabled=${track.enabled}, readyState=${track.readyState}, muted=${track.muted}`);
          console.log(`📊 [Check ${checkCount}] Audio levels - average: ${average.toFixed(2)}, max: ${max}`);
          
          if (average > 0 || max > 0) {
            console.log(`🔊 Audio detected for ${name}! Level: ${average.toFixed(2)}, Max: ${max}`);
          } else {
            console.log(`🔇 No audio detected for ${name} (track is ${track.readyState}, but silent)`);
          }
        };
        
        // Check multiple times over 5 seconds
        setTimeout(checkAudio, 1000);
        setTimeout(checkAudio, 2000);
        setTimeout(checkAudio, 3000);
        setTimeout(checkAudio, 5000);
        
        // Continuous monitoring for 10 seconds to catch any audio spikes
        let monitorCount = 0;
        monitorIntervalRef.current = setInterval(() => {
          monitorCount++;
          analyzer.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          const max = Math.max(...dataArray);
          
          if (average > 1 || max > 5) {
            console.log(`🎤 AUDIO SPIKE DETECTED for ${name}! avg: ${average.toFixed(2)}, max: ${max}`);
            if (monitorIntervalRef.current) {
              clearInterval(monitorIntervalRef.current);
              monitorIntervalRef.current = null;
            }
          }
          
          if (monitorCount >= 50) { // 50 * 200ms = 10 seconds
            console.log(`⏱️ Audio monitoring stopped for ${name} after 10 seconds`);
            if (monitorIntervalRef.current) {
              clearInterval(monitorIntervalRef.current);
              monitorIntervalRef.current = null;
            }
          }
        }, 200); // Check every 200ms
      }).catch(err => {
        console.error(`❌ Error playing audio for ${name}:`, err);
      });
    }
    
    return () => {
      // Cleanup on unmount
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (monitorIntervalRef.current) {
        clearInterval(monitorIntervalRef.current);
        monitorIntervalRef.current = null;
      }
    };
  }, [audioTrack, isLocal, name]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Debug log
  console.log(`👤 ParticipantCard render:`, {
    name,
    isLocal,
    isVideoEnabled,
    hasVideoTrack: Boolean(videoTrack),
    videoTrackId: videoTrack?.id,
  });

  // Simple and clear logic:
  // Show video if there's a video track (the actual media stream)
  // This is the source of truth - if track exists, video is streaming
  const shouldShowVideo = Boolean(videoTrack);

  return (
    <Card className="relative overflow-hidden shadow-lg border-2">
      <CardContent className="p-0 aspect-video flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        {shouldShowVideo ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isLocal}
            className="w-full h-full object-cover"
            style={isLocal ? { transform: 'scaleX(-1)' } : undefined}
          />
        ) : (
          <Avatar className="w-24 h-24 border-4 border-white shadow-lg">
            <AvatarFallback className="text-3xl bg-gradient-to-br from-blue-500 to-purple-500 text-white font-bold">
              {getInitials(name)}
            </AvatarFallback>
          </Avatar>
        )}

        {/* Audio element for remote participants */}
        {!isLocal && audioTrack && <audio ref={audioRef} autoPlay />}

        {/* Name and status overlay - Fixed positioning with proper padding */}
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
          <div className="flex items-center justify-between gap-2">
            {/* Name section - flexible width */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="font-semibold text-sm text-white drop-shadow-lg truncate">{name}</span>
              {isLocal && (
                <Badge className="text-xs px-2 py-0.5 bg-white/90 text-blue-700 border-0 flex-shrink-0">
                  You
                </Badge>
              )}
            </div>
            
            {/* Icons section - fixed width, no overflow */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Video state indicator */}
              {!isVideoEnabled && (
                <div className="bg-gray-700/90 rounded-full p-1.5 shadow-lg">
                  <VideoOff className="w-3.5 h-3.5 text-white" />
                </div>
              )}
              
              {/* Audio state indicator */}
              {isMuted ? (
                <div className="bg-red-500 rounded-full p-1.5 shadow-lg">
                  <MicOff className="w-3.5 h-3.5 text-white" />
                </div>
              ) : (
                <div className="bg-green-500/90 rounded-full p-1.5 shadow-lg">
                  <Mic className="w-3.5 h-3.5 text-white" />
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

ParticipantCard.displayName = 'ParticipantCard';

