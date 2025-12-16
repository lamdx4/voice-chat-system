import { Device, types } from 'mediasoup-client';
import { socketService } from '../services/socket';
import { useVoiceChatStore } from '../stores/voiceChatStore';
import { audioDeviceService } from '../services/audioDeviceService';

export class WebRTCService {
  private device: Device | null = null;
  private sendTransport: types.Transport | null = null;
  private recvTransport: types.Transport | null = null;
  private producers: Map<string, types.Producer> = new Map();
  private consumers: Map<string, types.Consumer> = new Map();
  private currentRoomId: string | null = null;
  private pendingProducers: Array<{ producerId: string, userId: string, kind: 'audio' | 'video', appData?: any }> = [];

  constructor() {
    this.device = new Device();
  }

  // Initialize device with RTP capabilities from server
  async initializeDevice(roomId: string) {
    try {
      this.currentRoomId = roomId;

      // Check if device is already loaded
      if (this.device && this.device.loaded) {
        console.log('✅ Device already loaded, skipping initialization');
        return true;
      }

      console.log('🎙️ Getting router RTP capabilities...');
      const rtpCapabilities = await socketService.getRouterRtpCapabilities(roomId);

      console.log('🎙️ Loading device...');
      if (!this.device) {
        this.device = new Device();
      }
      await this.device.load({ routerRtpCapabilities: rtpCapabilities });

      console.log('✅ Device loaded successfully');
      return true;
    } catch (error) {
      console.error('❌ Error initializing device:', error);
      throw error;
    }
  }

  // Create send transport for producing media
  async createSendTransport(roomId: string) {
    try {
      // Check if send transport already exists
      if (this.sendTransport && !this.sendTransport.closed) {
        console.log('✅ Send transport already exists, skipping creation');
        return this.sendTransport;
      }

      console.log('🚀 Creating send transport...');
      const response = await socketService.createTransport(roomId, 'send');

      if (!response.success || !response.params) {
        throw new Error('Failed to create transport: ' + (response.error || 'No params'));
      }

      const transportData = response.params;
      console.log('📦 Transport data received:', transportData);

      this.sendTransport = this.device!.createSendTransport({
        id: transportData.id,
        iceParameters: transportData.iceParameters,
        iceCandidates: transportData.iceCandidates,
        dtlsParameters: transportData.dtlsParameters,
      });

      // Handle connect event
      this.sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          await socketService.connectTransport(roomId, this.sendTransport!.id, dtlsParameters);
          callback();
        } catch (error) {
          errback(error as Error);
        }
      });

      // Handle produce event
      this.sendTransport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
        try {
          console.log('📤 [DEBUG] Producing with appData:', appData);

          const response = await socketService.produce(
            roomId,
            this.sendTransport!.id,
            kind,
            rtpParameters,
            appData  // ✅ Pass appData as separate parameter
          );

          if (!response.success || !response.producerId) {
            throw new Error('Failed to produce: ' + (response.error || 'No producerId'));
          }

          console.log('✅ Producer created on server:', response.producerId);
          callback({ id: response.producerId });
        } catch (error) {
          console.error('❌ Error in produce handler:', error);
          errback(error as Error);
        }
      });

      // Monitor connection state
      this.sendTransport.on('connectionstatechange', (state) => {
        console.log(`🔌 Send transport connection state: ${state}`);
        if (state === 'failed' || state === 'closed') {
          console.error('❌ Send transport connection failed!');
        }
      });

      console.log('✅ Send transport created');
      console.log(`  📊 Initial connection state: ${this.sendTransport.connectionState}`);
      return this.sendTransport;
    } catch (error) {
      console.error('❌ Error creating send transport:', error);
      throw error;
    }
  }

  // Create receive transport for consuming media
  async createRecvTransport(roomId: string) {
    try {
      // Check if receive transport already exists
      if (this.recvTransport && !this.recvTransport.closed) {
        console.log('✅ Receive transport already exists, skipping creation');
        return this.recvTransport;
      }

      console.log('🚀 Creating receive transport...');
      const response = await socketService.createTransport(roomId, 'receive');

      if (!response.success || !response.params) {
        throw new Error('Failed to create transport: ' + (response.error || 'No params'));
      }

      const transportData = response.params;
      console.log('📦 Receive transport data received:', transportData);

      this.recvTransport = this.device!.createRecvTransport({
        id: transportData.id,
        iceParameters: transportData.iceParameters,
        iceCandidates: transportData.iceCandidates,
        dtlsParameters: transportData.dtlsParameters,
      });

      // Handle connect event
      this.recvTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          await socketService.connectTransport(roomId, this.recvTransport!.id, dtlsParameters);
          callback();
        } catch (error) {
          errback(error as Error);
        }
      });

      // Monitor connection state
      this.recvTransport.on('connectionstatechange', (state) => {
        console.log(`🔌 Receive transport connection state: ${state}`);
        if (state === 'failed' || state === 'closed') {
          console.error('❌ Receive transport connection failed!');
        }
      });

      console.log('✅ Receive transport created');
      console.log(`  📊 Initial connection state: ${this.recvTransport.connectionState}`);
      return this.recvTransport;
    } catch (error) {
      console.error('❌ Error creating receive transport:', error);
      throw error;
    }
  }

  // Produce audio/video/screen
  async produce(track: MediaStreamTrack, source: 'mic' | 'webcam' | 'screen' = 'webcam') {
    try {
      if (!this.sendTransport) {
        throw new Error('Send transport not created');
      }

      console.log(`🎥 Producing ${track.kind} (source: ${source})...`);
      console.log(`  📊 Track state: enabled=${track.enabled}, readyState=${track.readyState}, muted=${track.muted}`);

      // ===== CODEC OPTIONS =====
      let produceOptions: any = {
        track,
        appData: { source } // Pass source in appData
      };

      if (track.kind === 'audio') {
        // Opus codec optimization for voice
        produceOptions.codecOptions = {
          opusStereo: false,              // Mono for voice
          opusFec: true,                  // ✅ Forward Error Correction (chống packet loss)
          opusDtx: true,                  // ✅ Discontinuous Transmission (im lặng = 0 data)
          opusMaxAverageBitrate: 40000,   // 40kbps (balanced quality)
          opusPtime: 20,                  // 20ms frame (low latency)
        };
        console.log('  🎙️ Using Opus codec options:', produceOptions.codecOptions);
      } else if (track.kind === 'video') {
        // Video encoding parameters (720p optimized)
        produceOptions.encodings = [
          {
            maxBitrate: 1500000,          // 1.5 Mbps for 720p
          }
        ];
        produceOptions.codecOptions = {
          videoGoogleStartBitrate: 1000,  // Start at 1 Mbps
        };
        console.log('  📹 Using video encoding options:', {
          encodings: produceOptions.encodings,
          codecOptions: produceOptions.codecOptions,
        });
      }

      const producer = await this.sendTransport.produce(produceOptions);

      this.producers.set(producer.id, producer);

      console.log(`  📊 Producer state: paused=${producer.paused}, closed=${producer.closed}`);

      // Monitor producer track ended
      producer.on('trackended', () => {
        console.log(`⚠️ Producer ${producer.id} track ended`);
      });

      producer.on('transportclose', () => {
        console.log(`⚠️ Producer ${producer.id} transport closed`);
      });

      // Monitor track state
      track.addEventListener('ended', () => {
        console.log(`⚠️ Track ${track.kind} ended`);
      });

      track.addEventListener('mute', () => {
        console.log(`🔇 Track ${track.kind} muted`);
      });

      track.addEventListener('unmute', () => {
        console.log(`🔊 Track ${track.kind} unmuted`);
      });

      // Update store with local track
      const store = useVoiceChatStore.getState();
      if (track.kind === 'audio') {
        store.setLocalAudioTrack(track);
        console.log('  ✅ Audio track set to store:', track.id);
      } else if (track.kind === 'video' && source !== 'screen') {
        // Only update localVideoTrack for camera, not screen share
        // Screen share track will be managed separately in startScreenShare()
        store.setLocalVideoTrack(track);
        console.log('  ✅ Video track set to store:', track.id);
      }

      console.log(`✅ ${track.kind} producer created:`, producer.id);
      console.log(`  📊 Send transport state: ${this.sendTransport?.connectionState}`);
      console.log(`  📊 Send transport ID: ${this.sendTransport?.id}`);

      // Monitor producer stats
      const statsInterval = setInterval(async () => {
        if (producer.closed) {
          clearInterval(statsInterval);
          return;
        }

        const stats = await producer.getStats();
        stats.forEach((stat: any) => {
          if (stat.type === 'outbound-rtp') {
            console.log(`📊 Producer ${producer.id} stats:`, {
              kind: stat.kind,
              bytesSent: stat.bytesSent,
              packetsSent: stat.packetsSent,
              transportState: this.sendTransport?.connectionState,
              timestamp: stat.timestamp
            });
          }
        });
      }, 3000); // Check every 3 seconds

      return producer;
    } catch (error) {
      console.error('❌ Error producing:', error);
      throw error;
    }
  }

  // Consume media from another participant
  async consume(producerId: string, userId: string, kind: 'audio' | 'video', appData: any = {}) {
    try {
      // If receive transport not ready yet, queue for later
      if (!this.recvTransport || !this.device || !this.currentRoomId) {
        console.log(`⏳ Transport not ready, queuing producer ${producerId} from user ${userId}`);
        this.pendingProducers.push({ producerId, userId, kind, appData });
        return;
      }

      console.log(`🎧 Consuming ${kind} from user ${userId}...`, appData);
      console.log(`  📋 Room: ${this.currentRoomId}`);
      console.log(`  📋 Producer: ${producerId}`);

      console.log('  📤 Sending consume request to server...');
      const response = await socketService.consume(
        this.currentRoomId,
        producerId,
        this.device.rtpCapabilities
      );
      console.log('  📥 Server response:', response);

      if (!response.success || !response.params) {
        throw new Error('Failed to consume: ' + (response.error || 'No params'));
      }

      const consumerData = response.params;
      console.log('  📦 Consumer data received:', consumerData);

      console.log('  🔨 Creating consumer on recv transport...');
      const consumer = await this.recvTransport.consume({
        id: consumerData.id,
        producerId: consumerData.producerId,
        kind: consumerData.kind,
        rtpParameters: consumerData.rtpParameters,
      });
      console.log('  ✅ Consumer created, ID:', consumer.id);
      console.log(`  📊 Consumer track: enabled=${consumer.track.enabled}, readyState=${consumer.track.readyState}, muted=${consumer.track.muted}`);

      this.consumers.set(consumer.id, consumer);

      // Monitor consumer events
      consumer.on('trackended', () => {
        console.log(`⚠️ Consumer ${consumer.id} track ended`);
      });

      consumer.on('transportclose', () => {
        console.log(`⚠️ Consumer ${consumer.id} transport closed`);
      });

      // Monitor consumer track
      consumer.track.addEventListener('ended', () => {
        console.log(`⚠️ Consumer ${consumer.id} track ${kind} ended`);
      });

      consumer.track.addEventListener('mute', () => {
        console.log(`🔇 Consumer ${consumer.id} track ${kind} muted`);
      });

      consumer.track.addEventListener('unmute', () => {
        console.log(`🔊 Consumer ${consumer.id} track ${kind} unmuted`);
      });

      // Resume consumer
      console.log('  ▶️ Resuming consumer...');
      await socketService.resumeConsumer(this.currentRoomId, consumer.id);
      console.log('  ✅ Consumer resumed');
      console.log(`  📊 Consumer state after resume: paused=${consumer.paused}`);

      // Update participant with track and enabled status
      console.log('  🔄 Updating participant with track...');
      const store = useVoiceChatStore.getState();

      // Check if this is a screen share
      const isScreenShare = appData && appData.source === 'screen';

      if (isScreenShare) {
        console.log('  🖥️ Handling screen share consumer...');
        // Create a virtual participant for the screen share
        const screenParticipantId = `screen-${userId}`;
        const originalParticipant = store.participants.get(userId);

        if (originalParticipant) {
          const screenParticipant: any = {
            userId: screenParticipantId,
            name: `${originalParticipant.name}'s Screen`,
            socketId: originalParticipant.socketId, // Reuse socketId
            isHost: false,
            isMuted: true, // Screen share usually has no audio or handled separately
            isVideoEnabled: true,
            videoTrack: consumer.track,
            isScreenSharing: true,
            // Custom flag to identify this as a virtual participant if needed
          };

          store.addParticipant(screenParticipant);
          console.log('  ✅ Virtual screen participant added:', screenParticipantId);
        } else {
          console.warn('  ⚠️ Original participant not found for screen share:', userId);
        }
      } else {
        // Normal camera/mic handling - only update track
        // Media state (isMuted, isVideoEnabled) preserved from:
        // 1. Initial participant data (joinRoom response)
        // 2. Media state update events (participantMediaStateUpdated)

        // Check current state BEFORE updating
        const participant = store.participants.get(userId);
        console.log(`🔍 BEFORE consume ${kind} for ${userId}:`, {
          hasParticipant: !!participant,
          isMuted: participant?.isMuted,
          isVideoEnabled: participant?.isVideoEnabled
        });

        const updates: any = {
          [kind === 'audio' ? 'audioTrack' : 'videoTrack']: consumer.track,
        };

        // Set smart defaults ONLY if state is undefined (preserve server state if exists)
        if (kind === 'video' && participant?.isVideoEnabled === undefined) {
          updates.isVideoEnabled = true;  // Default: enabled when first consuming
          console.log(`  ⚙️ Setting default isVideoEnabled = true (was undefined)`);
        }
        if (kind === 'audio' && participant?.isMuted === undefined) {
          updates.isMuted = false;  // Default: not muted when first consuming
          console.log(`  ⚙️ Setting default isMuted = false (was undefined)`);
        }

        console.log(`🔍 Updates to apply for ${userId}:`, updates);
        store.updateParticipant(userId, updates);
        console.log(`  ✅ Participant ${kind} track updated`);
      }

      console.log(`✅ ${kind} consumer created:`, consumer.id);
      console.log(`  📊 Recv transport state: ${this.recvTransport?.connectionState}`);
      console.log(`  📊 Recv transport ID: ${this.recvTransport?.id}`);

      // Monitor consumer stats
      const statsInterval = setInterval(async () => {
        if (consumer.closed) {
          clearInterval(statsInterval);
          return;
        }

        const stats = await consumer.getStats();
        stats.forEach((stat: any) => {
          if (stat.type === 'inbound-rtp') {
            console.log(`📊 Consumer ${consumer.id} stats:`, {
              kind: stat.kind,
              bytesReceived: stat.bytesReceived,
              packetsReceived: stat.packetsReceived,
              packetsLost: stat.packetsLost,
              jitter: stat.jitter,
              transportState: this.recvTransport?.connectionState,
              timestamp: stat.timestamp
            });
          }
        });
      }, 3000); // Check every 3 seconds

      return consumer;
    } catch (error) {
      console.error('❌ Error consuming:', error);
      throw error;
    }
  }

  // Get user media with optimized constraints
  async getUserMedia(audio: boolean = true, video: boolean = false): Promise<MediaStream> {
    try {
      console.log('🎥 Getting user media...', { audio, video });

      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const errorMsg = 'getUserMedia is not available. This may be because:\n' +
          '1. You are accessing via HTTP (not HTTPS) on a non-localhost domain\n' +
          '2. Your browser does not support getUserMedia\n' +
          '3. Browser permissions are blocked\n\n' +
          'Solution: Access via https:// or http://localhost:5173/';
        console.error('❌', errorMsg);
        throw new Error(errorMsg);
      }

      // ===== OPTIMIZED AUDIO CONSTRAINTS =====
      const audioConstraints: MediaTrackConstraints | boolean = audio ? {
        // WebRTC Audio Processing Module (APM)
        echoCancellation: true,        // ✅ Handle headphone + speakers
        noiseSuppression: true,        // ✅ Filter background noise
        autoGainControl: true,         // ✅ Stable volume

        // Quality settings
        sampleRate: 48000,             // Opus native rate
        channelCount: 1,               // Mono for voice (50% bandwidth reduction)
      } : false;

      // ===== OPTIMIZED VIDEO CONSTRAINTS =====
      const videoConstraints: MediaTrackConstraints | boolean = video ? {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30, max: 30 },
        aspectRatio: { ideal: 16 / 9 },
      } : false;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: videoConstraints
      });
      console.log('✅ User media obtained');

      // Verify and log applied settings
      stream.getTracks().forEach(track => {
        const settings = track.getSettings();
        console.log(`  📊 Track ${track.kind}:`, {
          enabled: track.enabled,
          readyState: track.readyState,
          muted: track.muted,
        });

        if (track.kind === 'audio') {
          console.log('  🎙️ Audio settings:', {
            echoCancellation: settings.echoCancellation,
            noiseSuppression: settings.noiseSuppression,
            autoGainControl: settings.autoGainControl,
            sampleRate: settings.sampleRate,
            channelCount: settings.channelCount,
          });
        } else if (track.kind === 'video') {
          console.log('  📹 Video settings:', {
            width: settings.width,
            height: settings.height,
            frameRate: settings.frameRate,
            aspectRatio: settings.aspectRatio,
          });
        }
      });

      return stream;
    } catch (error) {
      console.error('❌ Error getting user media:', error);
      throw error;
    }
  }

  // Get user media with specific device constraints
  async getUserMediaWithDevice(
    audioDeviceId?: string | null,
    videoDeviceId?: string | null,
    video: boolean = false
  ): Promise<MediaStream> {
    try {
      console.log('🎥 Getting user media with specific devices...', {
        audioDeviceId: audioDeviceId || 'default',
        videoDeviceId: videoDeviceId || 'default',
        video
      });

      return await audioDeviceService.getUserMediaWithDevice(audioDeviceId, videoDeviceId, video);
    } catch (error) {
      console.error('❌ Error getting user media with devices:', error);
      throw error;
    }
  }

  // Switch microphone input device during active call
  async switchMicrophone(deviceId: string | null): Promise<void> {
    try {
      console.log('🎤 Switching microphone to:', deviceId || 'default');

      // Find current audio producer
      const audioProducer = Array.from(this.producers.values()).find(p => p.kind === 'audio');
      if (!audioProducer) {
        console.warn('⚠️ No audio producer found, cannot switch microphone');
        return;
      }

      // Get current audio track state
      const wasEnabled = !audioProducer.paused;
      const oldTrack = audioProducer.track;

      console.log('  📊 Current audio producer state:', {
        id: audioProducer.id,
        paused: audioProducer.paused,
        closed: audioProducer.closed,
        trackId: oldTrack?.id,
      });

      // Get new audio stream with specific device
      console.log('  🎙️ Getting new audio stream...');
      const newStream = await this.getUserMediaWithDevice(deviceId, null, false);
      const newAudioTrack = newStream.getAudioTracks()[0];

      if (!newAudioTrack) {
        throw new Error('No audio track in new stream');
      }

      console.log('  ✅ New audio track obtained:', {
        id: newAudioTrack.id,
        label: newAudioTrack.label,
        enabled: newAudioTrack.enabled,
        readyState: newAudioTrack.readyState,
      });

      // Replace the track in the producer
      console.log('  🔄 Replacing audio track in producer...');
      await audioProducer.replaceTrack({ track: newAudioTrack });
      console.log('  ✅ Audio track replaced successfully');

      // Stop the old track
      if (oldTrack) {
        oldTrack.stop();
        console.log('  🛑 Old audio track stopped');
      }

      // Restore audio state
      if (wasEnabled) {
        audioProducer.resume();
        console.log('  ▶️ Audio producer resumed');
      } else {
        audioProducer.pause();
        console.log('  ⏸️ Audio producer paused (was muted)');
      }

      // Update local audio track in store
      useVoiceChatStore.getState().setLocalAudioTrack(newAudioTrack);
      console.log('  📝 Local audio track updated in store');

      // Update device selection in service
      audioDeviceService.setAudioInputDevice(deviceId);
      console.log('✅ Microphone switched successfully');

    } catch (error) {
      console.error('❌ Error switching microphone:', error);
      throw error;
    }
  }

  // Switch camera input device during active call
  async switchCamera(deviceId: string | null): Promise<void> {
    try {
      console.log('📹 Switching camera to:', deviceId || 'default');

      // Find current video producer
      const videoProducer = Array.from(this.producers.values()).find(p => p.kind === 'video');
      if (!videoProducer) {
        console.warn('⚠️ No video producer found, cannot switch camera');
        return;
      }

      // Get current video track state
      const wasEnabled = !videoProducer.paused;
      const oldTrack = videoProducer.track;

      console.log('  📊 Current video producer state:', {
        id: videoProducer.id,
        paused: videoProducer.paused,
        closed: videoProducer.closed,
        trackId: oldTrack?.id,
      });

      // Get new video stream with specific device
      console.log('  📷 Getting new video stream...');
      const newStream = await this.getUserMediaWithDevice(null, deviceId, true);
      const newVideoTrack = newStream.getVideoTracks()[0];

      if (!newVideoTrack) {
        throw new Error('No video track in new stream');
      }

      console.log('  ✅ New video track obtained:', {
        id: newVideoTrack.id,
        label: newVideoTrack.label,
        enabled: newVideoTrack.enabled,
        readyState: newVideoTrack.readyState,
      });

      // Replace the track in the producer
      console.log('  🔄 Replacing video track in producer...');
      await videoProducer.replaceTrack({ track: newVideoTrack });
      console.log('  ✅ Video track replaced successfully');

      // Stop the old track
      if (oldTrack) {
        oldTrack.stop();
        console.log('  🛑 Old video track stopped');
      }

      // Restore video state
      if (wasEnabled) {
        videoProducer.resume();
        console.log('  ▶️ Video producer resumed');
      } else {
        videoProducer.pause();
        console.log('  ⏸️ Video producer paused (was disabled)');
      }

      // Update local video track in store
      useVoiceChatStore.getState().setLocalVideoTrack(newVideoTrack);
      console.log('  📝 Local video track updated in store');

      console.log('✅ Camera switched successfully');

    } catch (error) {
      console.error('❌ Error switching camera:', error);
      throw error;
    }
  }

  // Mute/unmute audio
  muteAudio(muted: boolean) {
    const audioProducer = Array.from(this.producers.values()).find(p => p.kind === 'audio');
    if (audioProducer) {
      if (muted) {
        audioProducer.pause();
      } else {
        audioProducer.resume();
      }
      useVoiceChatStore.getState().setMuted(muted);
    }
  }

  // Enable/disable video
  enableVideo(enabled: boolean) {
    const videoProducer = Array.from(this.producers.values()).find(p => p.kind === 'video');
    if (videoProducer) {
      if (enabled) {
        videoProducer.resume();
      } else {
        videoProducer.pause();
      }
      useVoiceChatStore.getState().setVideoEnabled(enabled);
    }
  }

  // Stop video and close producer
  async stopVideo() {
    console.log('🛑 Stopping video...');
    const videoProducer = Array.from(this.producers.values()).find(p => p.kind === 'video');
    if (videoProducer) {
      // Get and stop the track
      const track = videoProducer.track;
      if (track) {
        track.stop();
        console.log('  ✅ Video track stopped');
      }

      // Close the producer
      videoProducer.close();
      this.producers.delete(videoProducer.id);
      console.log('  ✅ Video producer closed');

      // Clear local video track from store
      useVoiceChatStore.getState().setLocalVideoTrack(null);
      useVoiceChatStore.getState().setVideoEnabled(false);
    }
  }

  // Resume or start video
  async resumeOrStartVideo() {
    console.log('▶️ Resuming or starting video...');
    const videoProducer = Array.from(this.producers.values()).find(p => p.kind === 'video');

    if (videoProducer && !videoProducer.closed) {
      // Resume existing producer
      console.log('  ↩️ Resuming existing video producer');
      videoProducer.resume();

      // Re-set track to store (in case it was cleared)
      const track = videoProducer.track;
      if (track) {
        useVoiceChatStore.getState().setLocalVideoTrack(track);
        console.log('  ✅ Video track restored to store');
      }

      useVoiceChatStore.getState().setVideoEnabled(true);
    } else {
      // Create new producer
      console.log('  🆕 Creating new video producer');
      const stream = await this.getUserMedia(false, true);
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        await this.produce(videoTrack);
        useVoiceChatStore.getState().setVideoEnabled(true);
      }
    }
  }

  // Close producer
  closeProducer(producerId: string) {
    const producer = this.producers.get(producerId);
    if (producer) {
      producer.close();
      this.producers.delete(producerId);
    }
  }

  // Helper methods for managing consumers
  getConsumers() {
    return this.consumers;
  }

  removeConsumer(consumerId: string) {
    this.consumers.delete(consumerId);
  }

  // Close consumer
  closeConsumer(consumerId: string) {
    const consumer = this.consumers.get(consumerId);
    if (consumer) {
      consumer.close();
      this.consumers.delete(consumerId);
    }
  }

  // Start screen sharing
  async startScreenShare(userId: string, sourceId?: string) {
    try {
      if (!this.device || !this.sendTransport) {
        throw new Error('Device or transport not ready');
      }

      console.log('🖥️ Starting screen share...');
      let stream: MediaStream;

      if (sourceId) {
        // Electron: Use getUserMedia with chromeMediaSourceId
        console.log(`🖥️ Using specific source ID: ${sourceId}`);
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false, // System audio sharing is tricky in Electron, disabling for now
          video: {
            // @ts-ignore - Electron specific constraints
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: sourceId,
              minWidth: 1280,
              maxWidth: 1920,
              minHeight: 720,
              maxHeight: 1080,
            },
          },
        });
      } else {
        // Browser: Use standard getDisplayMedia
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 },
          },
          audio: false,
        });
      }

      const videoTrack = stream.getVideoTracks()[0];

      // Handle stream ended (user clicked "Stop sharing" in browser UI)
      videoTrack.onended = () => {
        console.log('🖥️ Screen share track ended');
        this.stopScreenShare();
      };

      // Produce the track
      // IMPORTANT: Pass source: 'screen' so appData is set correctly!
      await this.produce(videoTrack, 'screen');

      // Update local state
      const store = useVoiceChatStore.getState();
      store.setLocalScreenTrack(videoTrack);
      store.setScreenSharing(true); // ✅ Update UI state

      // Create virtual participant for local screen share
      // This makes the UI consistent - user sees their screen as a separate tile
      // Use the explicitly passed userId to find the correct base participant
      const currentUser = store.participants.get(userId);

      // If found, create the virtual participant
      if (currentUser) {
        const screenParticipant: any = {
          ...currentUser, // Copy all fields from current user
          userId: `screen-${userId}`, // Create distinct ID
          name: 'Màn hình của bạn',
          isScreenSharing: true,
          videoTrack: videoTrack,
          audioTrack: undefined, // Screen share has no audio
          isVideoEnabled: true,
          isMuted: true,
          isLocal: true // Mark as local
        };
        store.addParticipant(screenParticipant);
        console.log('  ✅ Created local screen share participant:', screenParticipant.userId);
      } else {
        // Fallback if current user not in store (shouldn't happen usually)
        console.warn(`Could not find current user ${userId} in participants store, creating barebones screen participant`);
        const screenParticipant: any = {
          userId: `screen-${userId}`,
          name: 'Màn hình của bạn',
          isScreenSharing: true,
          videoTrack: videoTrack,
          isVideoEnabled: true,
          isMuted: true,
          isLocal: true
        };
        store.addParticipant(screenParticipant);
        console.log('  ✅ Created fallback local screen share participant:', screenParticipant.userId);
      }

      console.log('✅ Screen share started');
    } catch (error) {
      console.error('❌ Error starting screen share:', error);
      throw error;
    }
  }

  // Stop screen sharing
  async stopScreenShare() {
    try {
      console.log('🛑 Stopping screen share...');

      // Find screen producer
      const screenProducer = Array.from(this.producers.values()).find(p => p.appData.source === 'screen');

      if (screenProducer) {
        const producerId = screenProducer.id;

        // Stop track
        if (screenProducer.track) {
          screenProducer.track.stop();
        }

        // Close producer (this will trigger 'transportclose' event on server)
        screenProducer.close();
        this.producers.delete(producerId);
        console.log('  ✅ Screen producer closed:', producerId);

        // Notify server explicitly to ensure remote peers are updated
        const roomId = useVoiceChatStore.getState().currentRoom?.roomId;
        if (roomId && socketService.isConnected()) {
          console.log('  📡 Sending closeProducer signal to server...');
          socketService.closeProducer(producerId)
            .then(() => console.log('  ✅ Server confirmed producer closed'))
            .catch(err => console.error('  ❌ Failed to notify server:', err));
        }
      }

      // Update store
      const store = useVoiceChatStore.getState();

      // Remove local screen share virtual participant
      // We know the current user's ID from the store (though not passed explicitly here, we can infer safe from local tracks)
      // BUT better to rely on known ID pattern.
      // Since we don't have userId passed here, we iterate to find the one with isLocal=true AND isScreenSharing=true
      // This is safer than finding "the user with local tracks" which might be ambiguous or fail if tracks are stopped.

      const localScreenParticipant = Array.from(store.participants.values()).find(
        p => p.isLocal && p.isScreenSharing && p.userId.startsWith('screen-')
      );

      if (localScreenParticipant) {
        store.removeParticipant(localScreenParticipant.userId);
        console.log('  ✅ Removed local screen share participant:', localScreenParticipant.userId);
      } else {
        console.warn('  ⚠️ Could not find local screen share participant to remove');
      }

      store.setLocalScreenTrack(null);
      store.setScreenSharing(false);

    } catch (error) {
      console.error('❌ Error stopping screen share:', error);
    }
  }

  // Cleanup all
  async cleanup() {
    console.log('🧹 Cleaning up WebRTC resources...');

    // Clear pending producers
    this.pendingProducers = [];

    // Close all producers
    for (const producer of this.producers.values()) {
      producer.close();
    }
    this.producers.clear();

    // Close all consumers
    for (const consumer of this.consumers.values()) {
      consumer.close();
    }
    this.consumers.clear();

    // Close transports
    if (this.sendTransport) {
      this.sendTransport.close();
      this.sendTransport = null;
    }

    if (this.recvTransport) {
      this.recvTransport.close();
      this.recvTransport = null;
    }

    this.currentRoomId = null;

    console.log('✅ Cleanup complete');
  }

  // Getters
  getDevice(): Device | null {
    return this.device;
  }

  canProduce(kind: 'audio' | 'video'): boolean {
    return this.device?.canProduce(kind) || false;
  }

  isReady(): boolean {
    return this.device !== null && this.device.loaded;
  }

  // Consume all pending producers that were queued before transports were ready
  async consumePendingProducers() {
    if (this.pendingProducers.length === 0) {
      console.log('✅ No pending producers to consume');
      return;
    }

    console.log(`🔄 Consuming ${this.pendingProducers.length} pending producers...`);
    const pending = [...this.pendingProducers];
    this.pendingProducers = []; // Clear queue

    for (const { producerId, userId, kind, appData } of pending) {
      await this.consume(producerId, userId, kind, appData);
    }
  }
}

// Singleton instance
export const webrtcService = new WebRTCService();

