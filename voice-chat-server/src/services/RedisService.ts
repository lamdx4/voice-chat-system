import Redis from 'ioredis';
import { config } from '../config/config';

class RedisService {
  private client: Redis;
  private isConnected: boolean = false;

  constructor() {
    this.client = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.client.on('connect', () => {
      console.log('✅ Redis connected successfully');
      this.isConnected = true;
    });

    this.client.on('error', (err) => {
      console.error('❌ Redis connection error:', err);
      this.isConnected = false;
    });
  }

  getClient(): Redis {
    return this.client;
  }

  isReady(): boolean {
    return this.isConnected;
  }

  async setRoomState(roomId: string, state: any): Promise<void> {
    await this.client.set(`room:${roomId}`, JSON.stringify(state));
  }

  async getRoomState(roomId: string): Promise<any> {
    const state = await this.client.get(`room:${roomId}`);
    return state ? JSON.parse(state) : null;
  }

  async deleteRoomState(roomId: string): Promise<void> {
    await this.client.del(`room:${roomId}`);
  }

  async setUserState(userId: string, state: any): Promise<void> {
    await this.client.set(`user:${userId}`, JSON.stringify(state));
  }

  async getUserState(userId: string): Promise<any> {
    const state = await this.client.get(`user:${userId}`);
    return state ? JSON.parse(state) : null;
  }

  async deleteUserState(userId: string): Promise<void> {
    await this.client.del(`user:${userId}`);
  }

  async close(): Promise<void> {
    await this.client.quit();
    this.isConnected = false;
  }
}

export default new RedisService();

