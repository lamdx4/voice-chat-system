import { User, UserStatus } from '../types';
import RedisService from './RedisService';

class UserManager {
  private users: Map<string, User> = new Map();

  async addUser(user: User): Promise<void> {
    this.users.set(user.userId, user);
    await RedisService.setUserState(user.userId, user);
    console.log(`✅ User added: ${user.name} (${user.userId}) - status: ${user.status}`);
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      Object.assign(user, updates);
      await RedisService.setUserState(userId, user);
    }
  }

  async removeUser(userId: string): Promise<void> {
    this.users.delete(userId);
    await RedisService.deleteUserState(userId);
    console.log(`✅ User removed: ${userId}`);
  }

  getUser(userId: string): User | undefined {
    return this.users.get(userId);
  }

  getUserBySocketId(socketId: string): User | undefined {
    return Array.from(this.users.values()).find(u => u.socketId === socketId);
  }

  getAllOnlineUsers(): User[] {
    return Array.from(this.users.values());
  }

  async setUserRoom(userId: string, roomId: string | undefined): Promise<void> {
    await this.updateUser(userId, { currentRoomId: roomId });
  }

  async setUserStatus(userId: string, status: UserStatus): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      console.log(`🔄 User ${user.name} status: ${user.status} → ${status}`);
      await this.updateUser(userId, { status });
    }
  }

  async restoreFromRedis(): Promise<void> {
    // This would require scanning Redis keys, for now we start fresh
    console.log('📥 UserManager: Starting fresh session');
  }
}

export default new UserManager();

