import { useEffect, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Mic, MicOff } from 'lucide-react';
import { audioDeviceService } from '../services/audioDeviceService';

interface ParticipantCardProps {
  name: string;
  isLocal?: boolean;
  isMuted?: boolean;
  isVideoEnabled?: boolean;
  audioTrack?: MediaStreamTrack;
  videoTrack?: MediaStreamTrack;
}

export function ParticipantCard({
  name,
  isLocal = false,
  isMuted = false,
  isVideoEnabled = false,
  audioTrack,
  videoTrack,
}: ParticipantCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const monitorIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Apply audio output device to audio element
  const applyAudioOutputDevice = useCallback(async () => {
    if (audioRef.current && !isLocal) {
      try {
        await audioDeviceService.applyAudioOutputDevice(audioRef.current);
        console.log(`✅ Audio output device applied for ${name}`);
      } catch (error) {
        console.warn(`⚠️ Failed to apply audio output device for ${name}:`, error);
      }
    }
  }, [name, isLocal]);

  // Listen for device changes
  useEffect(() => {
    const handleDeviceChange = () => {
      applyAudioOutputDevice();
    };

    audioDeviceService.addDeviceChangeListener(handleDeviceChange);

    return () => {
      audioDeviceService.removeDeviceChangeListener(handleDeviceChange);
    };
  }, [applyAudioOutputDevice]);

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
      console.log(`  📊 Stream tracks:`, stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState })));

      audioRef.current.play().then(async () => {
        console.log(`✅ Audio playing for ${name}`);
        console.log(`  📊 Audio state - paused: ${audioRef.current?.paused}, volume: ${audioRef.current?.volume}, readyState: ${audioRef.current?.readyState}`);

        // Apply audio output device after audio starts playing
        await applyAudioOutputDevice();

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

  const shouldShowVideo = isLocal
    ? (videoTrack || isVideoEnabled)  // Local: show if has track OR enabled (for timing)
    : (videoTrack && isVideoEnabled !== false);  // Remote: show only if has track AND not disabled

  console.log(`🎬 ${name} RENDER:`, {
    hasVideoTrack: !!videoTrack,
    isVideoEnabled,
    isLocal,
    shouldShowVideo
  });

  return (
    <Card className="relative overflow-hidden shadow-lg border-2 w-full h-full">
      <CardContent className="p-0 w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
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

        {/* Name and status overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
          {/* Desktop layout: name + icons in one row */}
          <div className="hidden sm:flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="font-semibold text-sm text-white drop-shadow-lg truncate">{name}</span>
              {isLocal && (
                <Badge className="text-xs px-2 py-0.5 bg-white/90 text-blue-700 border-0 flex-shrink-0">
                  You
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {isMuted && (
                <div className="bg-red-500 rounded-full p-1.5 shadow-lg">
                  <MicOff className="w-3.5 h-3.5 text-white" />
                </div>
              )}
              {!isMuted && isLocal && (
                <div className="bg-green-500 rounded-full p-1.5 shadow-lg animate-pulse">
                  <Mic className="w-3.5 h-3.5 text-white" />
                </div>
              )}
            </div>
          </div>

          {/* Mobile layout: name on top, icons below */}
          <div className="flex sm:hidden flex-col gap-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold text-sm text-white drop-shadow-lg truncate">{name}</span>
              {isLocal && (
                <Badge className="text-xs px-2 py-0.5 bg-white/90 text-blue-700 border-0 flex-shrink-0">
                  You
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {isMuted && (
                <div className="bg-red-500 rounded-full p-1.5 shadow-lg">
                  <MicOff className="w-3.5 h-3.5 text-white" />
                </div>
              )}
              {!isMuted && isLocal && (
                <div className="bg-green-500 rounded-full p-1.5 shadow-lg animate-pulse">
                  <Mic className="w-3.5 h-3.5 text-white" />
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


