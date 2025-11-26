import { io, Socket } from 'socket.io-client';
import { useVoiceChatStore } from '../stores/voiceChatStore';
import { useUserStore } from '../stores/userStore';
import { SERVER_URL } from '../../config/env';
import type {
  Room,
  User,
  IncomingCallEvent,
  UserJoinedEvent,
  UserLeftEvent,
  CallAcceptedEvent,
  CallRejectedEvent,
  CallEndedEvent,
  NewMessageEvent,
  NewProducerEvent,
  RoomListUpdatedEvent,
  OnlineUsersUpdatedEvent,
  CreateRoomPayload,
  JoinRoomPayload,
  AcceptCallPayload,
  RejectCallPayload,
  LeaveRoomPayload,
  EndCallPayload,
  SendMessagePayload,
  ReactToMessagePayload,
  CallUserPayload,
  AcceptCallPayloadNew,
  RejectCallPayloadNew,
  CancelCallPayload,
  IncomingCallEventNew,
  CallAcceptedEventNew,
  CallRejectedEventNew,
  CallCancelledEvent,
  CallTimeoutEvent,
} from '../types';

class SocketService {
  private socket: Socket | null = null;
  private serverUrl: string = SERVER_URL;

  constructor() {
    console.log('🔧 Socket service initialized with server URL:', this.serverUrl);
  }

  connect() {
    // If already have a socket instance, don't recreate
    if (this.socket) {
      if (this.socket.connected) {
        console.log('✅ Socket already connected');
        return;
      }
      // Socket exists but disconnected - reconnect it
      console.log('🔄 Reconnecting existing socket...');
      this.socket.connect();
      return;
    }

    const userStore = useUserStore.getState();
    const { userId, name, isStoreReady } = userStore;

    console.log('🔍 Connect attempt - User store state:', { 
      userId: userId?.substring(0, 8) + '...', 
      name, 
      isStoreReady,
      hasUserId: !!userId,
      hasName: !!name
    });

    // Check for both null/undefined AND empty string
    if (!userId || !name || userId.trim() === '' || name.trim() === '') {
      console.error('❌ Cannot connect: userId or name missing/empty', { 
        userId: userId || '(empty)',
        name: name || '(empty)',
        hasUserId: !!userId, 
        hasName: !!name,
        isStoreReady 
      });
      return;
    }

    console.log('🔌 Creating new socket connection to:', this.serverUrl);
    console.log('📤 Auth data:', { userId: userId.substring(0, 8) + '...', name });

    this.socket = io(this.serverUrl, {
      auth: {
        userId,
        name,
      },
      transports: ['websocket', 'polling'],
    });

    this.setupEventListeners();
  }

  disconnect() {
    if (this.socket) {
      console.log('🔌 Disconnecting from server...');
      this.socket.disconnect();
      this.socket = null;
      useVoiceChatStore.getState().setSocketConnected(false);
    }
  }

  private setupEventListeners() {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('✅ Connected to server');
      useVoiceChatStore.getState().setSocketConnected(true);
      
      // Get initial data
      this.getRooms();
      this.getOnlineUsers();
    });

    this.socket.on('reconnect', (attemptNumber: number) => {
      console.log('🔄 Reconnected to server after', attemptNumber, 'attempts');
      useVoiceChatStore.getState().setSocketConnected(true);
      
      // Get initial data after reconnect
      this.getRooms();
      this.getOnlineUsers();
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('❌ Disconnected from server. Reason:', reason);
      useVoiceChatStore.getState().setSocketConnected(false);
    });

    this.socket.on('connect_error', (error: Error) => {
      console.error('❌ Connection error:', error.message);
    });

    this.socket.on('reconnect_attempt', (attemptNumber: number) => {
      console.log('🔄 Attempting to reconnect... (attempt', attemptNumber, ')');
    });

    this.socket.on('reconnect_error', (error: Error) => {
      console.error('❌ Reconnection error:', error.message);
    });

    this.socket.on('reconnect_failed', () => {
      console.error('❌ Failed to reconnect after all attempts');
    });

    // Room events
    this.socket.on('incomingCall', (data: IncomingCallEvent) => {
      console.log('📞 Incoming call:', data);
      useVoiceChatStore.getState().setIncomingCall(data);
    });

    this.socket.on('userJoined', (data: UserJoinedEvent) => {
      console.log('👋 User joined:', data);
      
      // Add participant to the store
      const store = useVoiceChatStore.getState();
      store.addParticipant({
        userId: data.userId,
        name: data.userName,
        socketId: data.socketId,
        joinedAt: Date.now(),
        isHost: false,
        status: 'accepted' as any,
        isMuted: false,
        isVideoEnabled: false,
        isScreenSharing: false,
        localAudioTrack: null,
        localVideoTrack: null,
        localScreenTrack: null,
        producerIds: [],
        consumerIds: [],
      });
    });

    this.socket.on('userLeft', (data: UserLeftEvent) => {
      console.log('👋 User left:', data);
      const store = useVoiceChatStore.getState();
      store.removeParticipant(data.userId);
    });

    this.socket.on('callAccepted', (data: CallAcceptedEvent) => {
      console.log('✅ Call accepted:', data);
    });

    this.socket.on('callRejected', (data: CallRejectedEvent) => {
      console.log('❌ Call rejected:', data);
      useVoiceChatStore.getState().setIncomingCall(null);
    });

    this.socket.on('callEnded', async (data: CallEndedEvent) => {
      console.log('📞 Call ended:', data);
      
      // Show toast notification
      const { toast } = await import('sonner');
      toast.info(`${data.endedBy} đã kết thúc cuộc gọi`, {
        description: data.reason || 'Cuộc gọi đã kết thúc',
        duration: 4000,
      });
      
      useVoiceChatStore.getState().leaveRoom();
    });

    this.socket.on('newMessage', (data: NewMessageEvent) => {
      console.log('💬 New message:', data);
      useVoiceChatStore.getState().addMessage(data);
    });

    this.socket.on('messageReactionUpdated', (data: { messageId: string; reactions: any[] }) => {
      console.log('😀 Message reaction updated:', data);
      useVoiceChatStore.getState().updateMessageReactions(data.messageId, data.reactions);
    });

    this.socket.on('newProducer', async (data: NewProducerEvent) => {
      console.log('🎬 New producer available:', data);
      const store = useVoiceChatStore.getState();
      const currentRoom = store.currentRoom;
      
      if (!currentRoom) {
        console.log('❌ No current room, ignoring newProducer event');
        return;
      }

      // Dynamically import webrtcService to avoid circular dependency
      const { webrtcService } = await import('../lib/mediasoup');
      
      // Consume the new producer
      console.log(`📡 Consuming producer ${data.producerId} from user ${data.userId}`);
      try {
        await webrtcService.consume(data.producerId, data.userId, data.kind as 'audio' | 'video', data.appData);
        console.log('✅ Successfully consumed producer');
      } catch (error) {
        console.error('❌ Error consuming producer:', error);
      }
    });

    // Listen for producer closed events (e.g., when user stops screen share)
    this.socket.on('producerClosed', async (data: { producerId: string; userId: string; kind: string }) => {
      console.log('🛑 Producer closed:', data);
      const store = useVoiceChatStore.getState();
      
      // Dynamically import webrtcService to avoid circular dependency
      const { webrtcService } = await import('../lib/mediasoup');

      // Find and close the corresponding consumer
      const consumers = webrtcService.getConsumers();
      const consumer = Array.from(consumers.values()).find(
        c => c.producerId === data.producerId
      );
      
      if (consumer) {
        console.log(`  ✅ Closing consumer ${consumer.id} for closed producer ${data.producerId}`);
        consumer.close();
        webrtcService.removeConsumer(consumer.id);
        
        // Update store - remove participant if it was a screen share
        // Screen share virtual participants have ID like "screen-{userId}"
        const screenParticipantId = `screen-${data.userId}`;
        const participant = store.participants.get(screenParticipantId);
        
        if (participant) {
          console.log(`  🖥️ Removing screen share virtual participant: ${screenParticipantId}`);
          store.removeParticipant(screenParticipantId);
        } else {
          // If it's not a screen share, update the regular participant
          const regularParticipant = store.participants.get(data.userId);
          if (regularParticipant) {
            if (data.kind === 'video') {
              regularParticipant.videoTrack = undefined;
              regularParticipant.isVideoEnabled = false;
            } else if (data.kind === 'audio') {
              regularParticipant.audioTrack = undefined;
            }
            store.updateParticipant(data.userId, regularParticipant);
          }
        }
      } else {
        console.log(`  ⚠️ No consumer found for closed producer ${data.producerId}`);
      }
    });

    this.socket.on('participantMediaStateUpdated', (data: { userId: string; name: string; isMuted: boolean; isVideoEnabled: boolean }) => {
      console.log('🎙️📹 Participant media state updated:', data);
      const store = useVoiceChatStore.getState();
      
      // Update participant's media state
      store.updateParticipant(data.userId, {
        isMuted: data.isMuted,
        isVideoEnabled: data.isVideoEnabled,
      });
    });

    this.socket.on('roomListUpdated', (data: RoomListUpdatedEvent) => {
      console.log('🏠 Room list updated:', data.rooms.length, 'rooms');
      useVoiceChatStore.getState().setAvailableRooms(data.rooms);
    });

    this.socket.on('onlineUsersUpdated', (data: OnlineUsersUpdatedEvent) => {
      console.log('👥 Online users updated:', data.users.length, 'users');
      useVoiceChatStore.getState().setOnlineUsers(data.users);
    });

    // ===== NEW CALL MANAGEMENT EVENTS =====

    this.socket.on('incomingCallNew', (data: IncomingCallEventNew) => {
      console.log('📞 Incoming call (new):', data);
      const store = useVoiceChatStore.getState();
      
      const incomingCall = {
        callId: data.callId,
        fromUserId: data.from,
        fromUserName: data.fromName,
        receivedAt: Date.now(),
      };
      
      console.log('📞 Setting incoming call to store:', incomingCall);
      store.setIncomingCallNew(incomingCall);
      
      // Verify it was set
      console.log('📞 Incoming call state after set:', store.incomingCallNew);
    });

    this.socket.on('callAcceptedNew', (data: CallAcceptedEventNew) => {
      console.log('✅ Call accepted (new):', data);
      const store = useVoiceChatStore.getState();
      
      // Clear outgoing call and timeout
      store.clearCallTimeout();
      store.setOutgoingCall(null);
      
      // If room data is included, set it
      if (data.room) {
        store.setCurrentRoom(data.room);
      }
    });

    this.socket.on('callRejectedNew', (data: CallRejectedEventNew) => {
      console.log('❌ Call rejected (new):', data);
      const store = useVoiceChatStore.getState();
      
      // Clear outgoing call and timeout
      store.clearCallTimeout();
      store.setOutgoingCall(null);
      
      // Show toast (dynamic import)
      import('sonner').then(({ toast }) => {
        toast.error(`Call rejected: ${data.reason}`);
      });
    });

    this.socket.on('callCancelled', (data: CallCancelledEvent) => {
      console.log('🚫 Call cancelled:', data);
      const store = useVoiceChatStore.getState();
      
      // Clear incoming call
      const incomingCall = store.incomingCallNew;
      if (incomingCall && incomingCall.callId === data.callId) {
        store.setIncomingCallNew(null);
        
        // Show toast (dynamic import)
        import('sonner').then(({ toast }) => {
          toast.info('Call was cancelled');
        });
      }
    });

    this.socket.on('callTimeout', (data: CallTimeoutEvent) => {
      console.log('⏱️ Call timeout:', data);
      const store = useVoiceChatStore.getState();
      
      // Clear outgoing call and timeout
      store.clearCallTimeout();
      store.setOutgoingCall(null);
      
      // Show toast (dynamic import)
      import('sonner').then(({ toast }) => {
        toast.error('Call timed out - no answer');
      });
    });
  }

  // Emit methods

  createRoom(payload: CreateRoomPayload): Promise<{ success: boolean; roomId?: string; room?: Room; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve({ success: false, error: 'Not connected' });
        return;
      }

      this.socket.emit('createRoom', payload, (response: any) => {
        console.log('Create room response:', response);
        resolve(response);
      });
    });
  }

  joinRoom(payload: JoinRoomPayload): Promise<{ success: boolean; room?: Room; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve({ success: false, error: 'Not connected' });
        return;
      }

      this.socket.emit('joinRoom', payload, (response: any) => {
        console.log('Join room response:', response);
        resolve(response);
      });
    });
  }

  acceptCall(payload: AcceptCallPayload): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve({ success: false, error: 'Not connected' });
        return;
      }

      this.socket.emit('acceptCall', payload, (response: any) => {
        console.log('Accept call response:', response);
        resolve(response);
      });
    });
  }

  rejectCall(payload: RejectCallPayload): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve({ success: false, error: 'Not connected' });
        return;
      }

      this.socket.emit('rejectCall', payload, (response: any) => {
        console.log('Reject call response:', response);
        resolve(response);
      });
    });
  }

  leaveRoom(payload: LeaveRoomPayload): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve({ success: false, error: 'Not connected' });
        return;
      }

      this.socket.emit('leaveRoom', payload, (response: any) => {
        console.log('Leave room response:', response);
        resolve(response);
      });
    });
  }

  updateMediaState(roomId: string, isMuted: boolean, isVideoEnabled: boolean): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve({ success: false, error: 'Not connected' });
        return;
      }

      console.log('📤 Updating media state:', { roomId, isMuted, isVideoEnabled });
      this.socket.emit('mediaStateChanged', { roomId, isMuted, isVideoEnabled }, (response: any) => {
        console.log('Media state update response:', response);
        resolve(response || { success: true });
      });
    });
  }

  endCall(payload: EndCallPayload): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve({ success: false, error: 'Not connected' });
        return;
      }

      this.socket.emit('endCall', payload, (response: any) => {
        console.log('End call response:', response);
        resolve(response);
      });
    });
  }

  sendMessage(payload: SendMessagePayload): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve({ success: false, error: 'Not connected' });
        return;
      }

      this.socket.emit('sendMessage', payload, (response: any) => {
        console.log('Send message response:', response);
        resolve(response);
      });
    });
  }

  reactToMessage(payload: ReactToMessagePayload): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve({ success: false, error: 'Not connected' });
        return;
      }

      this.socket.emit('reactToMessage', payload, (response: any) => {
        console.log('React to message response:', response);
        resolve(response);
      });
    });
  }

  getRooms(): Promise<Room[]> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve([]);
        return;
      }

      this.socket.emit('getRooms', (rooms: Room[]) => {
        resolve(rooms);
      });
    });
  }

  getOnlineUsers(): Promise<User[]> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve([]);
        return;
      }

      this.socket.emit('getOnlineUsers', (users: User[]) => {
        resolve(users);
      });
    });
  }

  // WebRTC signaling methods (will be used by WebRTC service)

  getRouterRtpCapabilities(roomId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Not connected'));
        return;
      }

      this.socket.emit('getRouterRtpCapabilities', { roomId }, (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response.rtpCapabilities);
        }
      });
    });
  }

  createTransport(roomId: string, direction: 'send' | 'receive'): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Not connected'));
        return;
      }

      this.socket.emit('createTransport', { roomId, direction }, (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }

  connectTransport(roomId: string, transportId: string, dtlsParameters: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Not connected'));
        return;
      }

      console.log(`📤 [Frontend] Emitting connectTransport: transportId=${transportId}, roomId=${roomId}`);
      this.socket.emit('connectTransport', { roomId, transportId, dtlsParameters }, (response: any) => {
        console.log(`📥 [Frontend] connectTransport response:`, response);
        if (response.error) {
          console.error(`❌ [Frontend] connectTransport failed:`, response.error);
          reject(new Error(response.error));
        } else {
          console.log(`✅ [Frontend] connectTransport success`);
          resolve(response);
        }
      });
    });
  }

  produce(roomId: string, transportId: string, kind: 'audio' | 'video', rtpParameters: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Not connected'));
        return;
      }

      this.socket.emit('produce', { roomId, transportId, kind, rtpParameters }, (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }

  consume(roomId: string, producerId: string, rtpCapabilities: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Not connected'));
        return;
      }

      this.socket.emit('consume', { roomId, producerId, rtpCapabilities }, (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }

  resumeConsumer(roomId: string, consumerId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Not connected'));
        return;
      }

      this.socket.emit('resumeConsumer', { roomId, consumerId }, (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }

  // ===== NEW CALL MANAGEMENT METHODS =====

  callUser(
    callId: string,
    targetUserId: string,
    callback?: (response: { success: boolean; error?: string; canRetry?: boolean; message?: string }) => void
  ): void {
    if (!this.socket) {
      callback?.({ success: false, error: 'Not connected' });
      return;
    }

    const payload: CallUserPayload = { callId, targetUserId };
    this.socket.emit('callUser', payload, callback);
  }

  acceptCallNew(
    callId: string,
    callback?: (response: { success: boolean; roomId?: string; room?: Room; error?: string }) => void
  ): void {
    if (!this.socket) {
      callback?.({ success: false, error: 'Not connected' });
      return;
    }

    const payload: AcceptCallPayloadNew = { callId };
    this.socket.emit('acceptCallNew', payload, callback);
  }

  rejectCallNew(
    callId: string,
    reason?: string,
    callback?: (response: { success: boolean; error?: string; message?: string }) => void
  ): void {
    if (!this.socket) {
      callback?.({ success: false, error: 'Not connected' });
      return;
    }

    const payload: RejectCallPayloadNew = { callId, reason };
    this.socket.emit('rejectCallNew', payload, callback);
  }

  cancelCall(
    callId: string,
    callback?: (response: { success: boolean; error?: string; message?: string }) => void
  ): void {
    if (!this.socket) {
      callback?.({ success: false, error: 'Not connected' });
      return;
    }

    const payload: CancelCallPayload = { callId };
    this.socket.emit('cancelCall', payload, callback);
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

// Singleton instance
export const socketService = new SocketService();

