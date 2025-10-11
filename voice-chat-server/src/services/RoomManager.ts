import { v4 as uuidv4 } from 'uuid';
import {
  Room,
  RoomType,
  CallStatus,
  RoomParticipant,
  ChatMessage,
  RoomState,
  UserStatus,
} from '../types';
import RedisService from './RedisService';
import MediasoupService from './MediasoupService';
import UserManager from './UserManager';
import AsyncLock from '../utils/AsyncLock';
import {
  HOST_GRACE_PERIOD,
  ENABLE_HOSTLESS_MODE,
  MAX_GROUP_PARTICIPANTS,
  MAX_DIRECT_PARTICIPANTS,
} from '../config/constants';

class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private gracePeriodChecking: Set<string> = new Set(); // Track rooms being checked

  async createRoom(
    hostId: string,
    hostName: string,
    roomType: RoomType,
    roomName?: string,
    invitedUserIds?: string[]
  ): Promise<Room> {
    const roomId = uuidv4();

    // Create Mediasoup router for this room
    await MediasoupService.createRouter(roomId);

    const room: Room = {
      roomId,
      roomType,
      roomName: roomName || (roomType === RoomType.GROUP ? 'Group Call' : 'Direct Call'),
      hostId,
      hostName,
      status: CallStatus.PENDING,
      participants: new Map(),
      createdAt: Date.now(),
      isHostless: false,
      invitedUserIds: invitedUserIds || [],
      messages: [],
    };

    // Add host as first participant
    const hostParticipant: RoomParticipant = {
      userId: hostId,
      name: hostName,
      socketId: '', // Will be set when joining
      joinedAt: Date.now(),
      isHost: true,
      status: 'accepted',
      producers: new Map(),
      consumers: new Map(),
      // Media state - default to unmuted audio, video off
      isMuted: false,
      isVideoEnabled: false,
      mediaStateUpdatedAt: Date.now(),
    };

    room.participants.set(hostId, hostParticipant);
    this.rooms.set(roomId, room);

    await this.saveRoomToRedis(room);

    console.log(`✅ Room created: ${roomId} (${roomType}) by ${hostName}`);
    return room;
  }

  async getRoom(roomId: string): Promise<Room | undefined> {
    let room = this.rooms.get(roomId);
    
    if (!room) {
      // Try to restore from Redis
      room = await this.restoreRoomFromRedis(roomId);
    }
    
    return room;
  }

  async getAllActiveRooms(): Promise<Room[]> {
    // Return all active rooms (not ended)
    return Array.from(this.rooms.values()).filter(
      room => room.status !== CallStatus.ENDED
    );
  }

  async addParticipant(
    roomId: string,
    userId: string,
    name: string,
    socketId: string
  ): Promise<boolean> {
    const room = await this.getRoom(roomId);
    if (!room) return false;

    // Check if already in room - update socketId instead of returning false
    if (room.participants.has(userId)) {
      console.log(`⚠️ User ${userId} already in room ${roomId}, updating socketId`);
      const existingParticipant = room.participants.get(userId)!;
      existingParticipant.socketId = socketId;
      await this.saveRoomToRedis(room);
      return true;
    }

    // Check max participants only when adding NEW user
    const maxParticipants =
      room.roomType === RoomType.DIRECT
        ? MAX_DIRECT_PARTICIPANTS
        : MAX_GROUP_PARTICIPANTS;

    if (room.participants.size >= maxParticipants) {
      console.log(`❌ Room ${roomId} is full (${room.participants.size}/${maxParticipants})`);
      return false;
    }

    const participant: RoomParticipant = {
      userId,
      name,
      socketId,
      joinedAt: Date.now(),
      isHost: false,
      status: room.roomType === RoomType.DIRECT ? 'pending' : 'accepted',
      producers: new Map(),
      consumers: new Map(),
      // Media state - default to unmuted audio, video off
      isMuted: false,
      isVideoEnabled: false,
      mediaStateUpdatedAt: Date.now(),
    };

    room.participants.set(userId, participant);
    await this.saveRoomToRedis(room);

    console.log(`✅ Participant ${name} added to room ${roomId}`);
    return true;
  }

  async removeParticipant(roomId: string, userId: string): Promise<{ shouldEndCall: boolean }> {
    let shouldEndCall = false;

    // Use lock to prevent concurrent removals
    await AsyncLock.run(`room:${roomId}`, async () => {
      const room = await this.getRoom(roomId);
      if (!room) return;

      const participant = room.participants.get(userId);
      if (!participant) return;

      // Clean up WebRTC resources
      await this.cleanupParticipantResources(participant);

      room.participants.delete(userId);

      // For DIRECT calls, mark for ending (but don't end here - let SocketHandler emit event first)
      if (room.roomType === RoomType.DIRECT) {
        console.log(`📞 Direct call - participant left, will end call for room ${roomId}`);
        shouldEndCall = true;
        await this.saveRoomToRedis(room);
        return;
      }

      // Check if this was the host (only for GROUP calls)
      if (participant.isHost && !room.isHostless) {
        room.hostDisconnectedAt = Date.now();
        console.log(`⚠️ Host disconnected from room ${roomId}, grace period started`);
      }

      await this.saveRoomToRedis(room);

      console.log(`✅ Participant ${userId} removed from room ${roomId}`);
    });

    return { shouldEndCall };
  }

  async acceptCall(roomId: string, userId: string, userName: string): Promise<boolean> {
    const room = await this.getRoom(roomId);
    if (!room) return false;

    let participant = room.participants.get(userId);
    
    // If user not in participants yet, add them (happens when accepting a direct call)
    if (!participant) {
      console.log(`➕ Adding user ${userName} to room ${roomId} on accept`);
      participant = {
        userId,
        name: userName,
        socketId: '', // Will be set when joining
        joinedAt: Date.now(),
        isHost: false,
        status: 'accepted',
        producers: new Map(),
        consumers: new Map(),
        // Media state - default to unmuted audio, video off
        isMuted: false,
        isVideoEnabled: false,
        mediaStateUpdatedAt: Date.now(),
      };
      room.participants.set(userId, participant);
    } else {
      // User already in participants, just update status
      participant.status = 'accepted';
    }

    // Activate room if it was pending
    if (room.status === CallStatus.PENDING) {
      room.status = CallStatus.ACTIVE;
    }

    await this.saveRoomToRedis(room);
    return true;
  }

  async rejectCall(roomId: string, userId: string): Promise<{ success: boolean; shouldEndCall: boolean; userName?: string }> {
    const room = await this.getRoom(roomId);
    if (!room) return { success: false, shouldEndCall: false };

    const participant = room.participants.get(userId);
    if (!participant) return { success: false, shouldEndCall: false };

    const userName = participant.name;
    participant.status = 'rejected';
    await this.cleanupParticipantResources(participant);
    room.participants.delete(userId);

    // For DIRECT calls, mark for ending (let SocketHandler emit event)
    if (room.roomType === RoomType.DIRECT) {
      console.log(`📞 Direct call rejected, will end call for room ${roomId}`);
      await this.saveRoomToRedis(room);
      return { success: true, shouldEndCall: true, userName };
    }

    await this.saveRoomToRedis(room);
    return { success: true, shouldEndCall: false };
  }

  async endCall(roomId: string): Promise<void> {
    // Use lock to prevent concurrent end calls
    await AsyncLock.run(`room:${roomId}`, async () => {
      const room = await this.getRoom(roomId);
      if (!room) return;

      // Prevent double-ending
      if (room.status === CallStatus.ENDED) {
        console.log(`⚠️ Room ${roomId} already ended`);
        return;
      }

      room.status = CallStatus.ENDED;
      room.endedAt = Date.now();

      // Update all participants' status to IDLE before cleanup
      for (const participant of room.participants.values()) {
        await this.cleanupParticipantResources(participant);
        // Set user back to idle and clear room
        await UserManager.setUserRoom(participant.userId, undefined);
        await UserManager.setUserStatus(participant.userId, UserStatus.IDLE);
        console.log(`✅ Set user ${participant.userId} back to IDLE`);
      }

      // Close Mediasoup router
      MediasoupService.deleteRouter(roomId);

      await this.saveRoomToRedis(room);
      this.rooms.delete(roomId);

      console.log(`✅ Room ${roomId} ended and cleaned up`);
    });
  }

  async addMessage(
    roomId: string,
    userId: string,
    userName: string,
    content: string,
    replyTo?: { messageId: string; userName: string; content: string }
  ): Promise<ChatMessage | null> {
    const room = await this.getRoom(roomId);
    if (!room) return null;

    const message: ChatMessage = {
      messageId: uuidv4(),
      userId,
      userName,
      content,
      timestamp: Date.now(),
      replyTo,
      reactions: [],
    };

    room.messages.push(message);
    await this.saveRoomToRedis(room);

    return message;
  }

  async reactToMessage(
    roomId: string,
    messageId: string,
    userId: string,
    emoji: string
  ): Promise<ChatMessage | null> {
    const room = await this.getRoom(roomId);
    if (!room) return null;

    const message = room.messages.find(m => m.messageId === messageId);
    if (!message) return null;

    // Initialize reactions array if not exists
    if (!message.reactions) {
      message.reactions = [];
    }

    // Find existing reaction with this emoji
    const existingReaction = message.reactions.find(r => r.emoji === emoji);

    if (existingReaction) {
      // Toggle: remove user if already reacted, add if not
      const userIndex = existingReaction.userIds.indexOf(userId);
      if (userIndex > -1) {
        existingReaction.userIds.splice(userIndex, 1);
        existingReaction.count = existingReaction.userIds.length;
        
        // Remove reaction if no users left
        if (existingReaction.count === 0) {
          message.reactions = message.reactions.filter(r => r.emoji !== emoji);
        }
      } else {
        existingReaction.userIds.push(userId);
        existingReaction.count = existingReaction.userIds.length;
      }
    } else {
      // Create new reaction
      message.reactions.push({
        emoji,
        userIds: [userId],
        count: 1,
      });
    }

    await this.saveRoomToRedis(room);
    return message;
  }

  async handleHostReconnect(roomId: string, userId: string, socketId: string): Promise<boolean> {
    // Use lock to prevent race with grace period check
    return await AsyncLock.run(`room:${roomId}`, async () => {
      const room = await this.getRoom(roomId);
      if (!room || room.hostId !== userId) return false;

      // Check if room already ended or hostless
      if (room.status === CallStatus.ENDED || room.isHostless) {
        console.log(`⚠️ Host reconnect failed: room ${roomId} already ended or hostless`);
        return false;
      }

      const hostParticipant = room.participants.get(userId);
      if (!hostParticipant) return false;

      hostParticipant.socketId = socketId;
      room.hostDisconnectedAt = undefined;

      await this.saveRoomToRedis(room);
      console.log(`✅ Host reconnected to room ${roomId}`);
      return true;
    });
  }

  async checkHostGracePeriod(roomId: string): Promise<{ ended: boolean; hostless: boolean }> {
    // Prevent concurrent grace period checks for same room
    return await AsyncLock.run(`grace-period:${roomId}`, async () => {
      // Double-check: prevent multiple checks if already processing
      if (this.gracePeriodChecking.has(roomId)) {
        console.log(`⚠️ Grace period check already in progress for room ${roomId}`);
        return { ended: false, hostless: false };
      }

      this.gracePeriodChecking.add(roomId);

      try {
        const room = await this.getRoom(roomId);
        
        // Room không tồn tại, đã end, hoặc đã hostless
        if (!room || !room.hostDisconnectedAt || room.isHostless) {
          return { ended: false, hostless: false };
        }

        const gracePeriodExpired =
          Date.now() - room.hostDisconnectedAt > HOST_GRACE_PERIOD;

        if (gracePeriodExpired) {
          const hasOtherParticipants = 
            Array.from(room.participants.values()).filter(p => !p.isHost).length > 0;

          if (ENABLE_HOSTLESS_MODE && hasOtherParticipants) {
            // Switch to hostless mode
            room.isHostless = true;
            room.hostDisconnectedAt = undefined;
            console.log(`✅ Room ${roomId} switched to hostless mode`);
            await this.saveRoomToRedis(room);
            return { ended: false, hostless: true };
          } else {
            // End the call
            console.log(`⚠️ Grace period expired for room ${roomId}, ending call`);
            await this.endCall(roomId);
            return { ended: true, hostless: false };
          }
        }

        return { ended: false, hostless: false };
      } finally {
        this.gracePeriodChecking.delete(roomId);
      }
    });
  }

  getActiveRooms(): Room[] {
    return Array.from(this.rooms.values()).filter(
      (room) => room.status === CallStatus.ACTIVE || room.status === CallStatus.PENDING
    );
  }

  getGroupRooms(): Room[] {
    return this.getActiveRooms().filter(
      (room) => room.roomType === RoomType.GROUP
    );
  }

  private async cleanupParticipantResources(participant: RoomParticipant): Promise<void> {
    // Close all producers
    for (const producer of participant.producers.values()) {
      producer.close();
    }
    participant.producers.clear();

    // Close all consumers
    for (const consumer of participant.consumers.values()) {
      consumer.close();
    }
    participant.consumers.clear();
  }

  private async saveRoomToRedis(room: Room): Promise<void> {
    const roomState: RoomState = {
      roomId: room.roomId,
      roomType: room.roomType,
      roomName: room.roomName,
      hostId: room.hostId,
      hostName: room.hostName,
      status: room.status,
      participants: Array.from(room.participants.values()).map((p) => ({
        userId: p.userId,
        name: p.name,
        socketId: p.socketId,
        joinedAt: p.joinedAt,
        isHost: p.isHost,
        status: p.status,
        producerTransportId: p.producerTransportId,
        consumerTransportId: p.consumerTransportId,
        producerIds: Array.from(p.producers.keys()),
        consumerIds: Array.from(p.consumers.keys()),
      })),
      invitedUserIds: room.invitedUserIds,
      createdAt: room.createdAt,
      endedAt: room.endedAt,
      hostDisconnectedAt: room.hostDisconnectedAt,
      isHostless: room.isHostless,
      messages: room.messages,
    };

    await RedisService.setRoomState(room.roomId, roomState);
  }

  private async restoreRoomFromRedis(roomId: string): Promise<Room | undefined> {
    const roomState: RoomState | null = await RedisService.getRoomState(roomId);
    if (!roomState) return undefined;

    const room: Room = {
      roomId: roomState.roomId,
      roomType: roomState.roomType,
      roomName: roomState.roomName,
      hostId: roomState.hostId,
      hostName: roomState.hostName,
      status: roomState.status,
      participants: new Map(
        roomState.participants.map((p) => [
          p.userId,
          {
            userId: p.userId,
            name: p.name,
            socketId: p.socketId,
            joinedAt: p.joinedAt,
            isHost: p.isHost,
            status: p.status,
            producerTransportId: p.producerTransportId,
            consumerTransportId: p.consumerTransportId,
            producers: new Map(),
            consumers: new Map(),
            isMuted: (p as any).isMuted ?? false,
            isVideoEnabled: (p as any).isVideoEnabled ?? false,
            mediaStateUpdatedAt: (p as any).mediaStateUpdatedAt ?? Date.now(),
          },
        ])
      ),
      invitedUserIds: roomState.invitedUserIds,
      createdAt: roomState.createdAt,
      endedAt: roomState.endedAt,
      hostDisconnectedAt: roomState.hostDisconnectedAt,
      isHostless: roomState.isHostless,
      messages: roomState.messages,
    };

    this.rooms.set(roomId, room);
    return room;
  }

  /**
   * Serialize room object for client transmission
   */
  serializeRoom(room: Room) {
    return {
      roomId: room.roomId,
      roomType: room.roomType,
      roomName: room.roomName,
      hostId: room.hostId,
      hostName: room.hostName,
      status: room.status,
      participants: Array.from(room.participants.values()).map((p: RoomParticipant) => ({
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

export default new RoomManager();

