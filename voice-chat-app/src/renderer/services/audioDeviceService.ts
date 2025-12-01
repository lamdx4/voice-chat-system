export interface AudioDevice {
  deviceId: string;
  groupId: string;
  kind: 'audioinput' | 'audiooutput';
  label: string;
}

export interface CurrentDevices {
  audioInput: string | null; // deviceId or null for default
  audioOutput: string | null; // deviceId or null for default
}

class AudioDeviceService {
  private currentDevices: CurrentDevices = {
    audioInput: null,
    audioOutput: null,
  };

  private listeners: Set<() => void> = new Set();

  constructor() {
    // Listen for device changes
    if (navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener('devicechange', this.handleDeviceChange);
    }
  }

  private handleDeviceChange = () => {
    console.log('🔄 Audio devices changed');
    this.notifyListeners();
  };

  /**
   * Get all available audio input devices (microphones)
   */
  async getAudioInputDevices(): Promise<AudioDevice[]> {
    try {
      // Request permissions first to get device labels
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices
        .filter(device => device.kind === 'audioinput' && device.deviceId !== 'default' && device.deviceId !== 'communications')
        .map(device => ({
          deviceId: device.deviceId,
          groupId: device.groupId,
          kind: device.kind as 'audioinput',
          label: device.label || `Microphone ${device.deviceId.slice(0, 8)}`,
        }));

      console.log('🎤 Available audio input devices:', audioInputs);
      return audioInputs;
    } catch (error) {
      console.error('❌ Failed to get audio input devices:', error);
      return [];
    }
  }

  /**
   * Get all available audio output devices (speakers)
   */
  async getAudioOutputDevices(): Promise<AudioDevice[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioOutputs = devices
        .filter(device => device.kind === 'audiooutput' && device.deviceId !== 'default' && device.deviceId !== 'communications')
        .map(device => ({
          deviceId: device.deviceId,
          groupId: device.groupId,
          kind: device.kind as 'audiooutput',
          label: device.label || `Speaker ${device.deviceId.slice(0, 8)}`,
        }));

      console.log('🔊 Available audio output devices:', audioOutputs);
      return audioOutputs;
    } catch (error) {
      console.error('❌ Failed to get audio output devices:', error);
      return [];
    }
  }

  /**
   * Get currently selected devices
   */
  getCurrentDevices(): CurrentDevices {
    return { ...this.currentDevices };
  }

  /**
   * Set the current audio input device (microphone)
   */
  setAudioInputDevice(deviceId: string | null): void {
    console.log('🎤 Setting audio input device:', deviceId || 'default');
    this.currentDevices.audioInput = deviceId;
    this.notifyListeners();
  }

  /**
   * Set the current audio output device (speaker)
   */
  setAudioOutputDevice(deviceId: string | null): void {
    console.log('🔊 Setting audio output device:', deviceId || 'default');
    this.currentDevices.audioOutput = deviceId;
    this.notifyListeners();
  }

  /**
   * Apply audio output device to an HTMLAudioElement
   */
  async applyAudioOutputDevice(audioElement: HTMLAudioElement): Promise<void> {
    if (!audioElement.setSinkId) {
      console.warn('⚠️ setSinkId not supported in this browser');
      return;
    }

    try {
      const deviceId = this.currentDevices.audioOutput || 'default';
      await audioElement.setSinkId(deviceId);
      console.log('✅ Audio output device applied to element:', deviceId);
    } catch (error) {
      console.error('❌ Failed to set audio output device:', error);
      throw error;
    }
  }

  /**
   * Get user media with specific device constraints
   */
  async getUserMediaWithDevice(
    audioDeviceId?: string | null,
    videoDeviceId?: string | null,
    video: boolean = false
  ): Promise<MediaStream> {
    const constraints: MediaStreamConstraints = {};

    // Audio constraints
    if (audioDeviceId !== undefined) {
      constraints.audio = audioDeviceId 
        ? { 
            deviceId: { exact: audioDeviceId },
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000,
            channelCount: 1,
          }
        : {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000,
            channelCount: 1,
          };
    }

    // Video constraints
    if (video) {
      constraints.video = videoDeviceId 
        ? { 
            deviceId: { exact: videoDeviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30, max: 30 },
          }
        : {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30, max: 30 },
          };
    }

    console.log('🎥 Getting user media with device constraints:', constraints);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('✅ Got user media with specific devices');
      return stream;
    } catch (error) {
      console.error('❌ Failed to get user media with devices:', error);
      throw error;
    }
  }

  /**
   * Add listener for device changes
   */
  addDeviceChangeListener(callback: () => void): void {
    this.listeners.add(callback);
  }

  /**
   * Remove listener for device changes
   */
  removeDeviceChangeListener(callback: () => void): void {
    this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('❌ Error in device change listener:', error);
      }
    });
  }

  /**
   * Check if audio output device selection is supported
   */
  isAudioOutputSupported(): boolean {
    return 'setSinkId' in HTMLAudioElement.prototype;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (navigator.mediaDevices) {
      navigator.mediaDevices.removeEventListener('devicechange', this.handleDeviceChange);
    }
    this.listeners.clear();
  }
}

// Export singleton instance
export const audioDeviceService = new AudioDeviceService();
