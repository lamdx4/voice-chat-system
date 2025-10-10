import express, { Express } from 'express';
import { createServer, Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { networkInterfaces } from 'os';
import { config } from './config/config';
import apiRoutes from './routes/api';
import SocketHandler from './handlers/SocketHandler';
import MediasoupService from './services/MediasoupService';
import RedisService from './services/RedisService';
import RoomManager from './services/RoomManager';
import { CLEANUP_CHECK_INTERVAL } from './config/constants';

class App {
  private app: Express;
  private httpServer: HTTPServer;
  private io: SocketIOServer;
  private cleanupInterval?: NodeJS.Timeout;

  constructor() {
    this.app = express();
    this.httpServer = createServer(this.app);
    this.io = new SocketIOServer(this.httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    this.setupMiddlewares();
    this.setupRoutes();
    this.setupSocketIO();
  }

  private setupMiddlewares(): void {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req, _res, next) => {
      console.log(`${req.method} ${req.path}`);
      next();
    });
  }

  private setupRoutes(): void {
    this.app.use('/api', apiRoutes);

    // Root endpoint
    this.app.get('/', (_req, res) => {
      res.json({
        message: 'Voice Chat Server is running',
        version: '1.0.0',
      });
    });
  }

  private setupSocketIO(): void {
    SocketHandler.initialize(this.io);
  }

  private startCleanupTask(): void {
    // Periodically check for host grace period expiration
    this.cleanupInterval = setInterval(async () => {
      const rooms = RoomManager.getActiveRooms();
      for (const room of rooms) {
        if (room.hostDisconnectedAt) {
          const result = await RoomManager.checkHostGracePeriod(room.roomId);
          
          // If room ended or switched to hostless, broadcast updates
          if (result.ended || result.hostless) {
            // Broadcast room list update to all clients
            this.io.emit('roomListUpdated', {
              rooms: RoomManager.getGroupRooms().map(r => ({
                roomId: r.roomId,
                roomType: r.roomType,
                roomName: r.roomName,
                hostName: r.hostName,
                participantCount: r.participants.size,
                status: r.status,
                createdAt: r.createdAt,
                isHostless: r.isHostless,
              })),
            });

            // If room ended due to grace period, notify participants
            if (result.ended) {
              this.io.to(room.roomId).emit('callEnded', {
                roomId: room.roomId,
                endedBy: 'System (Host timeout)',
                reason: 'Host disconnected and grace period expired',
              });
            }

            // If switched to hostless, notify participants
            if (result.hostless) {
              this.io.to(room.roomId).emit('roomHostless', {
                roomId: room.roomId,
                message: 'Room switched to hostless mode',
              });
            }
          }
        }
      }
    }, CLEANUP_CHECK_INTERVAL);

    console.log('✅ Cleanup task started');
  }

  async initialize(): Promise<void> {
    console.log('🚀 Initializing Voice Chat Server...');

    try {
      // Initialize Mediasoup
      await MediasoupService.initialize();

      // Redis is initialized on import
      console.log('✅ Services initialized successfully');

      // Start cleanup task
      this.startCleanupTask();
    } catch (error) {
      console.error('❌ Failed to initialize services:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    await this.initialize();

    const port = config.server.port;

    const nets = networkInterfaces();
    let localIP = 'Not found';
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]!) {
        if (net.family === 'IPv4' && !net.internal) {
          localIP = net.address;
          break;
        }
      }
      if (localIP !== 'Not found') break;
    }

    this.httpServer.listen(port, () => {
      console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║   🎥 Voice Chat Server Started Successfully           ║
║                                                        ║
║   Port:        ${port}                                    ║
║   Environment: ${config.server.nodeEnv}                        ║
║   Redis:       ${config.redis.host}:${config.redis.port}                   ║
║   Workers:     ${config.mediasoup.numWorkers}                                     ║
║   Local IP:    ${localIP}                                    ║
║                                                        ║
║   HTTP:        http://localhost:${port}                   ║
║   Health:      http://localhost:${port}/api/health        ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
      `);
    });
  }

  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down server...');

    // Stop cleanup task
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Close Socket.IO
    this.io.close();

    // Close HTTP server
    this.httpServer.close();

    // Close Mediasoup
    await MediasoupService.close();

    // Close Redis
    await RedisService.close();

    console.log('✅ Server shutdown complete');
  }
}

export default App;
