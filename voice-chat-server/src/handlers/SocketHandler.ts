import { Server, Socket } from 'socket.io';
import MediasoupService from '../services/MediasoupService';
import RoomManager from '../services/RoomManager';
import UserManager from '../services/UserManager';
import TransportManager from '../services/TransportManager';
import CallManager from '../services/CallManager';
import {
  CreateRoomPayload,
  JoinRoomPayload,
  LeaveRoomPayload,
  AcceptCallPayload,
  RejectCallPayload,
  SendMessagePayload,
  ReactToMessagePayload,
  CreateTransportPayload,
  ConnectTransportPayload,
  ProducePayload,
  ConsumePayload,
  EndCallPayload,
  RoomType,
  User,
  UserStatus,
  CallUserPayload,
  AcceptCallPayloadNew,
  RejectCallPayloadNew,
  CancelCallPayload,
} from '../types';

class SocketHandler {
  // Track producers per room: Map<roomId, Map<userId, {producerId, kind, appData}[]>>
  private roomProducers: Map<string, Map<string, Array<{producerId: string, kind: string, appData?: any}>>> = new Map();

  initialize(io: Server): void {
    // Initialize CallManager
    CallManager.initialize(io);

    // Middleware to authenticate and extract user info
    io.use((socket, next) => {
      const { userId, name } = socket.handshake.auth;
      
      console.log('🔐 Auth attempt:', { userId, name, from: socket.handshake.address });

      if (!userId || !name) {
        console.error('❌ Auth failed: missing credentials', { userId, name });
        return next(new Error('Authentication failed: userId and name are required'));
      }

      // Attach user info to socket
      socket.data.userId = userId;
      socket.data.name = name;
      
      console.log('✅ Auth success:', { userId, name });
      next();
    });

    io.on('connection', async (socket: Socket) => {
      const { userId, name } = socket.data;
      console.log(`🔌 Client connected: ${name} (${userId})`);

      // Add user to UserManager with idle status
      const user: User = {
        userId,
        name,
        socketId: socket.id,
        status: UserStatus.IDLE,
        connectedAt: Date.now(),
      };
      await UserManager.addUser(user);

      // Send current room list to the newly connected user
      const rooms = await RoomManager.getAllActiveRooms();
      socket.emit('roomListUpdated', {
        rooms: rooms.map((room) => this.serializeRoom(room)),
      });

      // Broadcast online users to all clients
      this.broadcastOnlineUsers(io);

      // Setup event handlers
      this.handleCreateRoom(socket, io);
      this.handleJoinRoom(socket, io);
      this.handleLeaveRoom(socket, io);
      this.handleCallUser(socket);
      this.handleAcceptCallNew(socket);
      this.handleRejectCallNew(socket);
      this.handleCancelCall(socket);
      this.handleAcceptCall(socket, io);  // Keep old handler for group rooms
      this.handleRejectCall(socket, io);  // Keep old handler for group rooms
      this.handleEndCall(socket, io);
      this.handleSendMessage(socket, io);
      this.handleReactToMessage(socket, io);
      this.handleGetRooms(socket);
      this.handleGetOnlineUsers(socket);
      
      // WebRTC handlers
      this.handleGetRouterRtpCapabilities(socket);
      this.handleCreateTransport(socket);
      this.handleConnectTransport(socket);
      this.handleProduce(socket, io);
      this.handleConsume(socket);
      this.handleResumeConsumer(socket);
      this.handleCloseProducer(socket);
      
      // Media state handlers
      this.handleMediaStateChanged(socket, io);
      
      this.handleDisconnect(socket, io);
    });
  }

  private handleCreateRoom(socket: Socket, io: Server): void {
    socket.on('createRoom', async (payload: CreateRoomPayload, callback) => {
      try {
        const { userId, name } = socket.data;
        const { roomType, roomName, targetUserId, invitedUserIds } = payload;

        console.log(`📥 User ${name} creating ${roomType} room`);

        // Create room
        const room = await RoomManager.createRoom(userId, name, roomType, roomName, invitedUserIds);

        // If direct call, invite target user
        if (roomType === RoomType.DIRECT && targetUserId) {
          const targetUser = UserManager.getUser(targetUserId);
          if (targetUser) {
            // Check if target user is available
            if (targetUser.status === UserStatus.IN_CALL) {
              console.log(`⚠️ User ${targetUser.name} is already in a call`);
              return callback({
                success: false,
                error: `${targetUser.name} is currently in another call`,
              });
            }

            io.to(targetUser.socketId).emit('incomingCall', {
              roomId: room.roomId,
              roomType: room.roomType,
              fromUserId: userId,
              fromUserName: name,
            });
          }
        }

        // For GROUP calls, host auto-joins the room as participant
        if (roomType === RoomType.GROUP) {
          // Add host as participant
          await RoomManager.addParticipant(room.roomId, userId, name, socket.id);
          
          // Update host's status
          await UserManager.setUserRoom(userId, room.roomId);
          await UserManager.setUserStatus(userId, UserStatus.IN_CALL);
          
          console.log(`✅ Host ${name} auto-joined group call ${room.roomId}`);

          // If there are invited users, send invitations
          if (invitedUserIds && invitedUserIds.length > 0) {
            console.log(`📞 Sending group call invitations to ${invitedUserIds.length} users`);
            
            for (const invitedUserId of invitedUserIds) {
              // Double-check user status to prevent race conditions
              const invitedUser = UserManager.getUser(invitedUserId);
              
              if (!invitedUser) {
                console.log(`  ⚠️ User ${invitedUserId} not found, skipping`);
                continue;
              }

              // Check both status and roomId to ensure user is truly available
              if (invitedUser.status === UserStatus.IN_CALL || invitedUser.currentRoomId) {
                console.log(`  ⚠️ User ${invitedUser.name} is busy (status: ${invitedUser.status}, roomId: ${invitedUser.currentRoomId}), skipping invitation`);
                continue;
              }

              // User is available, send invitation
              io.to(invitedUser.socketId).emit('incomingCall', {
                roomId: room.roomId,
                roomType: room.roomType,
                roomName: room.roomName,
                fromUserId: userId,
                fromUserName: name,
              });
              console.log(`  📧 Invitation sent to ${invitedUser.name} (socketId: ${invitedUser.socketId})`);
            }
          }
        }

        // Join the room socket
        socket.join(room.roomId);

        // Broadcast updated room list and online users
        this.broadcastRoomList(io);
        this.broadcastOnlineUsers(io);

        callback({
          success: true,
          room: this.serializeRoom(room),
        });
      } catch (error: any) {
        console.error('Error creating room:', error);
        callback({
          success: false,
          error: error.message,
        });
      }
    });
  }

  private handleJoinRoom(socket: Socket, _io: Server): void {
    socket.on('joinRoom', async (payload: JoinRoomPayload, callback) => {
      try {
        const { userId, name } = socket.data;
        const { roomId } = payload;

        console.log(`📥 User ${name} joining room ${roomId}`);

        const success = await RoomManager.addParticipant(roomId, userId, name, socket.id);
        
        if (!success) {
          return callback({
            success: false,
            error: 'Failed to join room',
          });
        }

        const room = await RoomManager.getRoom(roomId);
        if (!room) {
          return callback({
            success: false,
            error: 'Room not found',
          });
        }

        // Join socket room
        socket.join(roomId);

        // Update user's current room and status
        await UserManager.setUserRoom(userId, roomId);
        await UserManager.setUserStatus(userId, UserStatus.IN_CALL);

        // Notify others in room
        socket.to(roomId).emit('userJoined', {
          userId,
          userName: name,
          socketId: socket.id,
        });

        // Send existing producers to the new user
        const roomProducers = this.roomProducers.get(roomId);
        if (roomProducers) {
          for (const [producerUserId, producers] of roomProducers.entries()) {
            if (producerUserId !== userId) { // Don't send own producers
              for (const {producerId, kind, appData} of producers) {
                console.log(`📤 Sending existing producer to ${name}:`, {producerId, kind, appData, from: producerUserId});
                socket.emit('newProducer', {
                  producerId,
                  userId: producerUserId,
                  kind,
                  appData,
                });
              }
            }
          }
        }

        // Send existing participants' media state to the new user
        console.log(`📤 Sending media states to ${name}`);
        for (const [participantId, participant] of room.participants.entries()) {
          if (participantId !== userId) {
            console.log(`  📤 Media state of ${participant.name}:`, { isMuted: participant.isMuted, isVideoEnabled: participant.isVideoEnabled });
            socket.emit('participantMediaStateUpdated', {
              userId: participantId,
              name: participant.name,
              isMuted: participant.isMuted,
              isVideoEnabled: participant.isVideoEnabled,
            });
          }
        }

        // Broadcast new user's media state to existing participants
        socket.to(roomId).emit('participantMediaStateUpdated', {
          userId,
          name,
          isMuted: false, // Default values
          isVideoEnabled: false,
        });

        callback({
          success: true,
          room: this.serializeRoom(room),
        });
      } catch (error: any) {
        console.error('Error joining room:', error);
        callback({
          success: false,
          error: error.message,
        });
      }
    });
  }

  private handleLeaveRoom(socket: Socket, io: Server): void {
    socket.on('leaveRoom', async (payload: LeaveRoomPayload, callback) => {
      try {
        const { userId, name } = socket.data;
        const { roomId } = payload;

        console.log(`📤 User ${name} leaving room ${roomId}`);

        await this.userLeaveRoom(userId, roomId, socket, io);

        callback({
          success: true,
          message: 'Left room successfully',
        });
      } catch (error: any) {
        console.error('Error leaving room:', error);
        callback({
          success: false,
          error: error.message,
        });
      }
    });
  }

  private handleAcceptCall(socket: Socket, io: Server): void {
    socket.on('acceptCall', async (payload: AcceptCallPayload, callback) => {
      try {
        const { userId, name } = socket.data;
        const { roomId } = payload;

        console.log(`✅ User ${name} (${userId}) accepting call ${roomId}`);

        const success = await RoomManager.acceptCall(roomId, userId, name);
        
        if (!success) {
          return callback({
            success: false,
            error: 'Failed to accept call',
          });
        }

        const room = await RoomManager.getRoom(roomId);
        if (!room) {
          return callback({
            success: false,
            error: 'Room not found',
          });
        }

        // Notify others that call was accepted
        socket.to(roomId).emit('callAccepted', {
          userId,
          roomId,
        });

        // Broadcast updated room list
        this.broadcastRoomList(io);

        callback({
          success: true,
          room: this.serializeRoom(room),
        });
      } catch (error: any) {
        console.error('Error accepting call:', error);
        callback({
          success: false,
          error: error.message,
        });
      }
    });
  }

  private handleRejectCall(socket: Socket, io: Server): void {
    socket.on('rejectCall', async (payload: RejectCallPayload, callback) => {
      try {
        const { userId, name } = socket.data;
        const { roomId } = payload;

        console.log(`❌ User ${name} rejecting call ${roomId}`);

        const result = await RoomManager.rejectCall(roomId, userId);
        
        if (!result.success) {
          return callback({
            success: false,
            error: 'Failed to reject call',
          });
        }

        // For DIRECT calls, end the call and notify
        if (result.shouldEndCall) {
          console.log(`📞 Ending direct call ${roomId} - call rejected`);
          
          // Notify remaining participant(s)
          io.to(roomId).emit('callEnded', {
            roomId,
            endedBy: result.userName || name,
            reason: 'Call was rejected',
          });

          // End the call
          await RoomManager.endCall(roomId);
          this.broadcastRoomList(io);

          callback({
            success: true,
            message: 'Call rejected and ended',
          });
          return;
        }

        // For GROUP calls, just notify rejection
        socket.to(roomId).emit('callRejected', {
          userId,
          userName: name,
          roomId,
        });

        // Broadcast updated room list
        this.broadcastRoomList(io);

        callback({
          success: true,
          message: 'Call rejected successfully',
        });
      } catch (error: any) {
        console.error('Error rejecting call:', error);
        callback({
          success: false,
          error: error.message,
        });
      }
    });
  }

  // ===== NEW CALL MANAGEMENT HANDLERS =====

  private handleCallUser(socket: Socket): void {
    socket.on('callUser', async (payload: CallUserPayload, callback) => {
      try {
        const { userId, name } = socket.data;
        const { callId, targetUserId } = payload;

        console.log(`📞 User ${name} calling ${targetUserId} (callId: ${callId})`);

        const result = CallManager.handleCallUser(callId, userId, name, targetUserId);

        if (!result.success) {
          return callback({
            success: false,
            error: result.error,
            canRetry: result.canRetry,
          });
        }

        callback({
          success: true,
          message: 'Call initiated',
        });
      } catch (error: any) {
        console.error('Error calling user:', error);
        callback({
          success: false,
          error: error.message,
        });
      }
    });
  }

  private handleAcceptCallNew(socket: Socket): void {
    socket.on('acceptCallNew', async (payload: AcceptCallPayloadNew, callback) => {
      try {
        const { userId, name } = socket.data;
        const { callId } = payload;

        console.log(`✅ User ${name} accepting call ${callId}`);

        const result = await CallManager.handleAcceptCall(callId, userId);

        if (!result.success) {
          return callback({
            success: false,
            error: result.error,
          });
        }

        // Get room to fetch full info
        const room = await RoomManager.getRoom(result.roomId!);
        if (!room) {
          return callback({
            success: false,
            error: 'Room not found',
          });
        }

        // Join room socket
        socket.join(result.roomId!);

        // Get IO from socket
        const io = socket.nsp.server;

        // Notify caller to also join socket room
        const call = CallManager.getCall(callId);
        if (call) {
          const callerUser = UserManager.getUser(call.from);
          if (callerUser) {
            io.sockets.sockets.get(callerUser.socketId)?.join(result.roomId!);
          }
        }

        // Broadcast updated online users (status changed to in_call)
        this.broadcastOnlineUsers(io);

        callback({
          success: true,
          roomId: result.roomId,
          room: this.serializeRoom(room),
        });
      } catch (error: any) {
        console.error('Error accepting call:', error);
        callback({
          success: false,
          error: error.message,
        });
      }
    });
  }

  private handleRejectCallNew(socket: Socket): void {
    socket.on('rejectCallNew', async (payload: RejectCallPayloadNew, callback) => {
      try {
        const { userId, name } = socket.data;
        const { callId, reason } = payload;

        console.log(`❌ User ${name} rejecting call ${callId}`);

        const result = CallManager.handleRejectCall(callId, userId, reason);

        if (!result.success) {
          return callback({
            success: false,
            error: result.error,
          });
        }

        callback({
          success: true,
          message: 'Call rejected',
        });
      } catch (error: any) {
        console.error('Error rejecting call:', error);
        callback({
          success: false,
          error: error.message,
        });
      }
    });
  }

  private handleCancelCall(socket: Socket): void {
    socket.on('cancelCall', async (payload: CancelCallPayload, callback) => {
      try {
        const { userId, name } = socket.data;
        const { callId } = payload;

        console.log(`🚫 User ${name} cancelling call ${callId}`);

        const result = CallManager.handleCancelCall(callId, userId);

        if (!result.success) {
          return callback({
            success: false,
            error: result.error,
          });
        }

        callback({
          success: true,
          message: 'Call cancelled',
        });
      } catch (error: any) {
        console.error('Error cancelling call:', error);
        callback({
          success: false,
          error: error.message,
        });
      }
    });
  }

  private handleEndCall(socket: Socket, io: Server): void {
    socket.on('endCall', async (payload: EndCallPayload, callback) => {
      try {
        const { userId, name } = socket.data;
        const { roomId } = payload;

        console.log(`🛑 User ${name} ending call ${roomId}`);

        const room = await RoomManager.getRoom(roomId);
        if (!room) {
          return callback({
            success: false,
            error: 'Room not found',
          });
        }

        // Only host or hostless room can end call
        if (room.hostId !== userId && !room.isHostless) {
          return callback({
            success: false,
            error: 'Only host can end the call',
          });
        }

        // Notify all participants
        io.to(roomId).emit('callEnded', {
          roomId,
          endedBy: name,
        });

        // End the call
        await RoomManager.endCall(roomId);

        // Update all participants' room status
        for (const participant of room.participants.values()) {
          await UserManager.setUserRoom(participant.userId, undefined);
        }

        // Broadcast updated room list to ALL users (not just in room)
        // This is important so everyone sees the room is gone
        this.broadcastRoomList(io);

        callback({
          success: true,
          message: 'Call ended successfully',
        });
      } catch (error: any) {
        console.error('Error ending call:', error);
        callback({
          success: false,
          error: error.message,
        });
      }
    });
  }

  private handleSendMessage(socket: Socket, io: Server): void {
    socket.on('sendMessage', async (payload: SendMessagePayload, callback) => {
      try {
        const { userId, name } = socket.data;
        const { roomId, content, replyTo } = payload;

        console.log(`💬 User ${name} sending message to room ${roomId}`, replyTo ? '(replying)' : '');

        const message = await RoomManager.addMessage(roomId, userId, name, content, replyTo);
        
        if (!message) {
          return callback({
            success: false,
            error: 'Failed to send message',
          });
        }

        // Broadcast message to all in room
        io.to(roomId).emit('newMessage', message);

        callback({
          success: true,
          message,
        });
      } catch (error: any) {
        console.error('Error sending message:', error);
        callback({
          success: false,
          error: error.message,
        });
      }
    });
  }

  private handleReactToMessage(socket: Socket, io: Server): void {
    socket.on('reactToMessage', async (payload: ReactToMessagePayload, callback) => {
      try {
        const { userId } = socket.data;
        const { roomId, messageId, emoji } = payload;

        console.log(`😀 User ${userId} reacting ${emoji} to message ${messageId}`);

        const message = await RoomManager.reactToMessage(roomId, messageId, userId, emoji);
        
        if (!message) {
          return callback({
            success: false,
            error: 'Failed to react to message',
          });
        }

        // Broadcast reaction update to all in room
        io.to(roomId).emit('messageReactionUpdated', {
          messageId,
          reactions: message.reactions,
        });

        callback({
          success: true,
          message,
        });
      } catch (error: any) {
        console.error('Error reacting to message:', error);
        callback({
          success: false,
          error: error.message,
        });
      }
    });
  }

  private handleGetRooms(socket: Socket): void {
    socket.on('getRooms', async (callback) => {
      try {
        const rooms = RoomManager.getGroupRooms();
        
        callback({
          success: true,
          rooms: rooms.map(room => this.serializeRoom(room)),
        });
      } catch (error: any) {
        console.error('Error getting rooms:', error);
        callback({
          success: false,
          error: error.message,
        });
      }
    });
  }

  private handleGetOnlineUsers(socket: Socket): void {
    socket.on('getOnlineUsers', async (callback) => {
      try {
        const users = UserManager.getAllOnlineUsers();
        
        callback({
          success: true,
          users,
        });
      } catch (error: any) {
        console.error('Error getting online users:', error);
        callback({
          success: false,
          error: error.message,
        });
      }
    });
  }

  private handleGetRouterRtpCapabilities(socket: Socket): void {
    socket.on('getRouterRtpCapabilities', async ({ roomId }, callback) => {
      try {
        const router = MediasoupService.getRouter(roomId);
        if (!router) {
          throw new Error('Router not found for room');
        }

        callback({
          success: true,
          rtpCapabilities: router.rtpCapabilities,
        });
      } catch (error: any) {
        console.error('Error getting RTP capabilities:', error);
        callback({
          success: false,
          error: error.message,
        });
      }
    });
  }

  private handleCreateTransport(socket: Socket): void {
    socket.on('createTransport', async (payload: CreateTransportPayload, callback) => {
      try {
        const { roomId, direction } = payload;
        const { userId } = socket.data;

        const router = MediasoupService.getRouter(roomId);
        if (!router) {
          throw new Error('Router not found for room');
        }

        const transport = await MediasoupService.createWebRtcTransport(router);
        
        // Store transport
        TransportManager.addTransport(transport.id, transport);

        // Update participant transport ID
        const room = await RoomManager.getRoom(roomId);
        if (room) {
          const participant = room.participants.get(userId);
          if (participant) {
            if (direction === 'send') {
              participant.producerTransportId = transport.id;
            } else {
              participant.consumerTransportId = transport.id;
            }
          }
        }

        console.log(`✅ Created ${direction} transport ${transport.id} for user ${userId}`);

        callback({
          success: true,
          params: {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
          },
        });
      } catch (error: any) {
        console.error('Error creating transport:', error);
        callback({
          success: false,
          error: error.message,
        });
      }
    });
  }

  private handleConnectTransport(socket: Socket): void {
    socket.on('connectTransport', async (payload: ConnectTransportPayload, callback) => {
      try {
        console.log('🔌 connectTransport event received:', payload);
        const { transportId, dtlsParameters } = payload;

        const transport = TransportManager.getTransport(transportId);
        if (!transport) {
          console.error(`❌ Transport ${transportId} not found!`);
          throw new Error('Transport not found');
        }

        console.log(`🔗 Connecting transport ${transportId}...`);
        await transport.connect({ dtlsParameters });

        console.log(`✅ Transport ${transportId} connected`);

        callback({
          success: true,
        });
      } catch (error: any) {
        console.error('Error connecting transport:', error);
        callback({
          success: false,
          error: error.message,
        });
      }
    });
  }

  private handleProduce(socket: Socket, _io: Server): void {
    socket.on('produce', async (payload: ProducePayload, callback) => {
      try {
        const { roomId, transportId, kind, rtpParameters, appData = {} } = payload;  // ✅ Extract appData
        const { userId, name } = socket.data;

        console.log('📥 [DEBUG] Received produce with appData:', appData);

        const transport = TransportManager.getTransport(transportId);
        if (!transport) {
          throw new Error('Transport not found');
        }

        // ✅ Pass appData to producer
        const producer = await transport.produce({ kind, rtpParameters, appData });
        
        console.log('📥 [DEBUG] Producer created with appData:', producer.appData);

        // Listen for producer close event (e.g., when user stops screen sharing)
        producer.on('transportclose', () => {
          console.log(`🚪 Producer ${producer.id} transport closed`);
        });

        // When producer is closed (e.g., stopScreenShare calls producer.close())
        producer.observer.on('close', () => {
          console.log(`🛑 Producer ${producer.id} (${kind}) closed for user ${userId}`);
          
          // Remove from room tracking
          const roomProducersMap = this.roomProducers.get(roomId);
          if (roomProducersMap) {
            const userProducers = roomProducersMap.get(userId);
            if (userProducers) {
              const index = userProducers.findIndex(p => p.producerId === producer.id);
              if (index !== -1) {
                userProducers.splice(index, 1);
                console.log(`  ✅ Removed producer ${producer.id} from tracking`);
              }
            }
          }

          // Notify other participants that this producer is closed
          console.log(`📢 Broadcasting producerClosed event to room ${roomId}`);
          socket.to(roomId).emit('producerClosed', {
            producerId: producer.id,
            userId,
            kind,
          });
          console.log(`✅ producerClosed event sent for producer ${producer.id}`);
        });

        // Store producer in room participant
        const room = await RoomManager.getRoom(roomId);
        if (room) {
          const participant = room.participants.get(userId);
          if (participant) {
            participant.producers.set(kind, producer);
          }
        }

        console.log(`✅ Producer created: ${producer.id} (${kind}) for user ${userId}`);

        // Save producer to tracking
        console.log(`🔍 Saving producer to roomProducers map...`);
        console.log(`  📊 roomProducers.has(${roomId}):`, this.roomProducers.has(roomId));
        
        if (!this.roomProducers.has(roomId)) {
          console.log(`  📝 Creating new entry for room ${roomId}`);
          this.roomProducers.set(roomId, new Map());
        }
        const roomProducers = this.roomProducers.get(roomId)!;
        
        console.log(`  📊 roomProducers.has(${userId}):`, roomProducers.has(userId));
        if (!roomProducers.has(userId)) {
          console.log(`  📝 Creating new array for user ${userId}`);
          roomProducers.set(userId, []);
        }
        
        // ✅ Store appData from producer (not from rtpParameters)
        roomProducers.get(userId)!.push({ producerId: producer.id, kind, appData: producer.appData });
        console.log(`💾 Saved producer for user ${userId} in room ${roomId}:`, { producerId: producer.id, kind, appData: producer.appData });
        console.log(`  📊 Total producers for user ${userId}:`, roomProducers.get(userId)!.length);

        // Notify other participants about new producer
        console.log(`📢 Broadcasting newProducer event to room ${roomId} (excluding sender ${name})`);
        console.log(`  📊 Producer: ${producer.id} (${kind}) from user ${userId}`);
        socket.to(roomId).emit('newProducer', {
          producerId: producer.id,
          userId,
          kind,
          appData: producer.appData,  // ✅ Send producer.appData (not payload appData)
        });
        console.log(`✅ newProducer event sent to room ${roomId}`);

        callback({
          success: true,
          producerId: producer.id,
        });
      } catch (error: any) {
        console.error('Error producing:', error);
        callback({
          success: false,
          error: error.message,
        });
      }
    });
  }

  private handleCloseProducer(socket: Socket): void {
    socket.on('closeProducer', async (payload: { producerId: string }, callback) => {
      try {
        const { producerId } = payload;
        const { userId } = socket.data;
        
        console.log(`🛑 [DEBUG] Received closeProducer request for ${producerId} from ${userId}`);

        // Find the room this user is in
        let roomId: string | null = null;
        let kind: string | null = null;
        
        for (const [rid, roomProducersMap] of this.roomProducers.entries()) {
          const userProducers = roomProducersMap.get(userId);
          if (userProducers) {
            const producerEntry = userProducers.find(p => p.producerId === producerId);
            if (producerEntry) {
              roomId = rid;
              kind = producerEntry.kind;
              
              // Remove from tracking
              const index = userProducers.findIndex(p => p.producerId === producerId);
              if (index !== -1) {
                userProducers.splice(index, 1);
                console.log(`  ✅ [DEBUG] Removed producer ${producerId} from tracking`);
              }
              break;
            }
          }
        }

        if (roomId && kind) {
          // Broadcast to other participants
          console.log(`  📢 [DEBUG] Broadcasting producerClosed to room ${roomId}`);
          socket.to(roomId).emit('producerClosed', {
            producerId,
            userId,
            kind,
          });
          console.log(`  ✅ [DEBUG] producerClosed event sent`);
          
          callback({ success: true });
        } else {
          console.warn(`  ⚠️ [DEBUG] Producer ${producerId} not found in tracking`);
          callback({ success: false, error: 'Producer not found' });
        }
        
      } catch (error: any) {
        console.error('❌ Error in closeProducer:', error);
        callback({ success: false, error: error.message });
      }
    });
  }

  private handleConsume(socket: Socket): void {
    socket.on('consume', async (payload: ConsumePayload, callback) => {
      try {
        const { roomId, producerId, rtpCapabilities } = payload;
        const { userId } = socket.data;

        const router = MediasoupService.getRouter(roomId);
        if (!router) {
          throw new Error('Router not found');
        }

        if (!router.canConsume({ producerId, rtpCapabilities })) {
          throw new Error('Cannot consume');
        }

        const room = await RoomManager.getRoom(roomId);
        if (!room) {
          throw new Error('Room not found');
        }

        const participant = room.participants.get(userId);
        if (!participant || !participant.consumerTransportId) {
          throw new Error('Consumer transport not found');
        }

        const transport = TransportManager.getTransport(participant.consumerTransportId);
        if (!transport) {
          throw new Error('Transport not found');
        }

        const consumer = await transport.consume({
          producerId,
          rtpCapabilities,
          paused: true, // Start paused
        });

        // Store consumer
        participant.consumers.set(producerId, consumer);

        console.log(`✅ Consumer created: ${consumer.id} for producer ${producerId}`);

        callback({
          success: true,
          params: {
            id: consumer.id,
            producerId,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters,
          },
        });
      } catch (error: any) {
        console.error('Error consuming:', error);
        callback({
          success: false,
          error: error.message,
        });
      }
    });
  }

  private handleResumeConsumer(socket: Socket): void {
    socket.on('resumeConsumer', async ({ roomId, consumerId }, callback) => {
      try {
        const { userId } = socket.data;

        const room = await RoomManager.getRoom(roomId);
        if (!room) {
          throw new Error('Room not found');
        }

        const participant = room.participants.get(userId);
        if (!participant) {
          throw new Error('Participant not found');
        }

        const consumer = Array.from(participant.consumers.values()).find(
          c => c.id === consumerId
        );

        if (!consumer) {
          throw new Error('Consumer not found');
        }

        await consumer.resume();

        console.log(`✅ Consumer resumed: ${consumerId}`);

        callback({
          success: true,
        });
      } catch (error: any) {
        console.error('Error resuming consumer:', error);
        callback({
          success: false,
          error: error.message,
        });
      }
    });
  }

  private handleMediaStateChanged(socket: Socket, _io: Server): void {
    socket.on('mediaStateChanged', async (payload: { roomId: string; isMuted: boolean; isVideoEnabled: boolean }, callback) => {
      try {
        const { userId, name } = socket.data;
        const { roomId, isMuted, isVideoEnabled } = payload;

        console.log(`🎙️📹 Media state changed for ${name}:`, { isMuted, isVideoEnabled });

        const room = await RoomManager.getRoom(roomId);
        if (!room) {
          return callback?.({
            success: false,
            error: 'Room not found',
          });
        }

        const participant = room.participants.get(userId);
        if (!participant) {
          return callback?.({
            success: false,
            error: 'Participant not found',
          });
        }

        // Update participant media state
        participant.isMuted = isMuted;
        participant.isVideoEnabled = isVideoEnabled;
        participant.mediaStateUpdatedAt = Date.now();

        console.log(`✅ Updated media state for ${name} in room ${roomId}`);

        // Broadcast to other participants in room
        socket.to(roomId).emit('participantMediaStateUpdated', {
          userId,
          name,
          isMuted,
          isVideoEnabled,
        });

        callback?.({
          success: true,
        });
      } catch (error: any) {
        console.error('❌ Error updating media state:', error);
        callback?.({
          success: false,
          error: error.message,
        });
      }
    });
  }

  private handleDisconnect(socket: Socket, io: Server): void {
    socket.on('disconnect', async () => {
      const { userId, name } = socket.data;
      console.log(`🔌 Client disconnected: ${name} (${userId})`);

      const user = UserManager.getUser(userId);
      if (user && user.currentRoomId) {
        // User was in a room - leave and notify
        await this.userLeaveRoom(userId, user.currentRoomId, socket, io);
        
        // Broadcast updated room list (important for group rooms)
        this.broadcastRoomList(io);
      }

      // Remove user from online users
      await UserManager.removeUser(userId);

      // Broadcast updated online users
      this.broadcastOnlineUsers(io);
    });
  }

  private async userLeaveRoom(
    userId: string,
    roomId: string,
    socket: Socket,
    io: Server
  ): Promise<void> {
    const room = await RoomManager.getRoom(roomId);
    if (!room) return;

    const participant = room.participants.get(userId);
    const isHost = participant?.isHost || false;

    // Remove participant and check if call should end (for DIRECT calls)
    const { shouldEndCall } = await RoomManager.removeParticipant(roomId, userId);

    // Cleanup user's producers from tracking
    const roomProducers = this.roomProducers.get(roomId);
    if (roomProducers) {
      roomProducers.delete(userId);
      console.log(`🧹 Cleaned up producers for user ${userId} in room ${roomId}`);
      // Clean up empty room entry
      if (roomProducers.size === 0) {
        this.roomProducers.delete(roomId);
      }
    }

    // For DIRECT calls, end immediately and notify
    if (shouldEndCall) {
      console.log(`📞 Ending direct call ${roomId} - participant left`);
      
      // IMPORTANT: Update leaving user's status FIRST (before endCall)
      await UserManager.setUserRoom(userId, undefined);
      await UserManager.setUserStatus(userId, UserStatus.IDLE);
      console.log(`✅ Set leaving user ${userId} to IDLE`);
      
      // Leave socket room
      socket.leave(roomId);
      
      // Notify remaining participant(s) before ending
      io.to(roomId).emit('callEnded', {
        roomId,
        endedBy: participant?.name || 'User',
        reason: 'Participant left the call',
      });

      // End the call (will set remaining participants to IDLE)
      await RoomManager.endCall(roomId);
      this.broadcastRoomList(io);
      this.broadcastOnlineUsers(io);
      return;
    }

    // For GROUP calls, update user status normally
    await UserManager.setUserRoom(userId, undefined);
    await UserManager.setUserStatus(userId, UserStatus.IDLE);

    // Leave socket room
    socket.leave(roomId);

    // For GROUP calls, notify others that user left
    socket.to(roomId).emit('userLeft', {
      userId,
      roomId,
    });

    // Broadcast updated online users (status changed to idle)
    this.broadcastOnlineUsers(io);

    // If host left, start grace period check (GROUP calls only)
    if (isHost && !room.isHostless) {
      setTimeout(async () => {
        const result = await RoomManager.checkHostGracePeriod(roomId);
        
        // Broadcast updates if room state changed
        if (result.ended || result.hostless) {
          this.broadcastRoomList(io);
          
          // Notify room participants about the change
          if (result.ended) {
            io.to(roomId).emit('callEnded', {
              roomId,
              endedBy: 'System (Host timeout)',
              reason: 'Host disconnected and grace period expired',
            });
          }
          
          if (result.hostless) {
            io.to(roomId).emit('roomHostless', {
              roomId,
              message: 'Room switched to hostless mode',
            });
          }
        }
      }, 1000);
    }

    // Always broadcast updated room list when someone leaves
    this.broadcastRoomList(io);
  }

  private broadcastRoomList(io: Server): void {
    const rooms = RoomManager.getGroupRooms();
    io.emit('roomListUpdated', {
      rooms: rooms.map(room => this.serializeRoom(room)),
    });
  }

  private broadcastOnlineUsers(ioServer: Server): void {
    const users = UserManager.getAllOnlineUsers();
    ioServer.emit('onlineUsersUpdated', { users });
  }

  private serializeRoom(room: any) {
    return {
      roomId: room.roomId,
      roomType: room.roomType,
      roomName: room.roomName,
      hostId: room.hostId,
      hostName: room.hostName,
      status: room.status,
      participants: Array.from(room.participants.values()).map((p: any) => ({
        userId: p.userId,
        name: p.name,
        socketId: p.socketId,
        joinedAt: p.joinedAt,
        isHost: p.isHost,
        status: p.status,
      })),
      createdAt: room.createdAt,
      isHostless: room.isHostless,
      messageCount: room.messages.length,
    };
  }
}

export default new SocketHandler();
