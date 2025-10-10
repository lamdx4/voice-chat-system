import { Router, Request, Response } from 'express';
import MediasoupService from '../services/MediasoupService';
import RedisService from '../services/RedisService';
import RoomManager from '../services/RoomManager';
import UserManager from '../services/UserManager';

const router = Router();

// Health check endpoint
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    redis: RedisService.isReady() ? 'connected' : 'disconnected',
    mediasoup: {
      workers: MediasoupService.getWorkers().length,
    },
  });
});

// Get server info
router.get('/info', (_req: Request, res: Response) => {
  res.json({
    name: 'Voice Chat Server',
    version: '1.0.0',
    capabilities: ['video', 'audio', 'screen-sharing'],
  });
});

// Get active rooms
router.get('/rooms', (_req: Request, res: Response) => {
  const rooms = RoomManager.getActiveRooms();
  res.json({
    success: true,
    rooms: rooms.map(room => ({
      roomId: room.roomId,
      roomType: room.roomType,
      roomName: room.roomName,
      hostName: room.hostName,
      participantCount: room.participants.size,
      status: room.status,
      createdAt: room.createdAt,
      isHostless: room.isHostless,
    })),
  });
});

// Get room details
router.get('/rooms/:roomId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { roomId } = req.params;
    const room = await RoomManager.getRoom(roomId);

    if (!room) {
      res.status(404).json({
        success: false,
        error: 'Room not found',
      });
      return;
    }

    res.json({
      success: true,
      room: {
        roomId: room.roomId,
        roomType: room.roomType,
        roomName: room.roomName,
        hostId: room.hostId,
        hostName: room.hostName,
        status: room.status,
        participants: Array.from(room.participants.values()).map(p => ({
          userId: p.userId,
          name: p.name,
          isHost: p.isHost,
          status: p.status,
          joinedAt: p.joinedAt,
        })),
        messageCount: room.messages.length,
        createdAt: room.createdAt,
        isHostless: room.isHostless,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get online users
router.get('/users/online', (_req: Request, res: Response) => {
  const users = UserManager.getAllOnlineUsers();
  res.json({
    success: true,
    users: users.map(u => ({
      userId: u.userId,
      name: u.name,
      currentRoomId: u.currentRoomId,
      connectedAt: u.connectedAt,
    })),
  });
});

export default router;
