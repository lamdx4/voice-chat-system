import { useState, useEffect, useCallback } from 'react';
import { Settings, Mic, Volume2, ChevronDown, Check } from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { audioDeviceService, AudioDevice, CurrentDevices } from '../services/audioDeviceService';

interface DeviceSelectorProps {
  onMicrophoneChange?: (deviceId: string | null) => void;
  onSpeakerChange?: (deviceId: string | null) => void;
  disabled?: boolean;
}

export function DeviceSelector({ 
  onMicrophoneChange, 
  onSpeakerChange, 
  disabled = false 
}: DeviceSelectorProps) {
  const [audioInputDevices, setAudioInputDevices] = useState<AudioDevice[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<AudioDevice[]>([]);
  const [currentDevices, setCurrentDevices] = useState<CurrentDevices>({
    audioInput: null,
    audioOutput: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isAudioOutputSupported, setIsAudioOutputSupported] = useState(false);

  // Load devices and current selections
  const loadDevices = useCallback(async () => {
    setIsLoading(true);
    try {
      const [inputDevices, outputDevices] = await Promise.all([
        audioDeviceService.getAudioInputDevices(),
        audioDeviceService.getAudioOutputDevices(),
      ]);

      setAudioInputDevices(inputDevices);
      setAudioOutputDevices(outputDevices);
      setCurrentDevices(audioDeviceService.getCurrentDevices());
      setIsAudioOutputSupported(audioDeviceService.isAudioOutputSupported());
    } catch (error) {
      console.error('❌ Failed to load audio devices:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle device changes from service
  const handleDeviceChange = useCallback(() => {
    loadDevices();
  }, [loadDevices]);

  useEffect(() => {
    // Initial load
    loadDevices();

    // Listen for device changes
    audioDeviceService.addDeviceChangeListener(handleDeviceChange);

    return () => {
      audioDeviceService.removeDeviceChangeListener(handleDeviceChange);
    };
  }, [loadDevices, handleDeviceChange]);

  const handleMicrophoneSelect = useCallback((deviceId: string | null) => {
    console.log('🎤 Selecting microphone:', deviceId || 'default');
    audioDeviceService.setAudioInputDevice(deviceId);
    setCurrentDevices(audioDeviceService.getCurrentDevices());
    onMicrophoneChange?.(deviceId);
  }, [onMicrophoneChange]);

  const handleSpeakerSelect = useCallback((deviceId: string | null) => {
    console.log('🔊 Selecting speaker:', deviceId || 'default');
    audioDeviceService.setAudioOutputDevice(deviceId);
    setCurrentDevices(audioDeviceService.getCurrentDevices());
    onSpeakerChange?.(deviceId);
  }, [onSpeakerChange]);


  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="lg"
          disabled={disabled || isLoading}
          className="gap-2"
        >
          <Settings className="w-5 h-5" />
          Audio
          <ChevronDown className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80" side="top" align="center">
        <div className="px-2 py-1.5 text-sm font-medium flex items-center gap-2">
          <Settings className="w-4 h-4" />
          Audio Settings
        </div>
        <div className="border-t my-1" />

        {/* Microphone Section */}
        <div className="px-2 py-2">
          <div className="flex items-center gap-2 mb-2">
            <Mic className="w-4 h-4" />
            <span className="text-sm font-medium">Microphone</span>
          </div>
          
          <div className="space-y-1">
            {/* Default Microphone */}
            <DropdownMenuItem
              onClick={() => handleMicrophoneSelect(null)}
              className="flex items-center justify-between rounded-md"
            >
              <span className="text-sm">Default</span>
              {!currentDevices.audioInput && (
                <Check className="w-4 h-4 text-blue-500" />
              )}
            </DropdownMenuItem>

            {/* Microphone Devices */}
            {audioInputDevices.map((device) => (
              <DropdownMenuItem
                key={device.deviceId}
                onClick={() => handleMicrophoneSelect(device.deviceId)}
                className="flex items-center justify-between rounded-md"
              >
                <span className="text-sm truncate pr-2">{device.label}</span>
                {currentDevices.audioInput === device.deviceId && (
                  <Check className="w-4 h-4 text-blue-500 flex-shrink-0" />
                )}
              </DropdownMenuItem>
            ))}

            {audioInputDevices.length === 0 && !isLoading && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                No microphones found
              </div>
            )}
          </div>
        </div>

        <div className="border-t my-1" />

        {/* Speaker Section */}
        {isAudioOutputSupported ? (
          <div className="px-2 py-2">
            <div className="flex items-center gap-2 mb-2">
              <Volume2 className="w-4 h-4" />
              <span className="text-sm font-medium">Speaker</span>
            </div>
            
            <div className="space-y-1">
              {/* Default Speaker */}
              <DropdownMenuItem
                onClick={() => handleSpeakerSelect(null)}
                className="flex items-center justify-between rounded-md"
              >
                <span className="text-sm">Default</span>
                {!currentDevices.audioOutput && (
                  <Check className="w-4 h-4 text-blue-500" />
                )}
              </DropdownMenuItem>

              {/* Speaker Devices */}
              {audioOutputDevices.map((device) => (
                <DropdownMenuItem
                  key={device.deviceId}
                  onClick={() => handleSpeakerSelect(device.deviceId)}
                  className="flex items-center justify-between rounded-md"
                >
                  <span className="text-sm truncate pr-2">{device.label}</span>
                  {currentDevices.audioOutput === device.deviceId && (
                    <Check className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  )}
                </DropdownMenuItem>
              ))}

              {audioOutputDevices.length === 0 && !isLoading && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  No speakers found
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="px-2 py-2">
            <div className="flex items-center gap-2 mb-2">
              <Volume2 className="w-4 h-4 opacity-50" />
              <span className="text-sm font-medium opacity-50">Speaker</span>
            </div>
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              Speaker selection not supported in this browser
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <>
            <div className="border-t my-1" />
            <div className="px-2 py-1.5 text-xs text-muted-foreground text-center">
              Loading devices...
            </div>
          </>
        )}

        {/* Device Count Info */}
        <div className="border-t my-1" />
        <div className="px-2 py-1.5 text-xs text-muted-foreground flex justify-between">
          <span>🎤 {audioInputDevices.length} microphones</span>
          <span>🔊 {audioOutputDevices.length} speakers</span>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
