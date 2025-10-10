import { Server } from 'socket.io';
import { CallState, PendingCall, RoomType, UserStatus } from '../types';
import UserManager from './UserManager';
import RoomManager from './RoomManager';

class CallManager {
  private calls: Map<string, PendingCall> = new Map();
  private io: Server | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize CallManager with Socket.IO instance
   */
  initialize(io: Server): void {
    this.io = io;
    this.startCleanupJob();
    console.log('✅ CallManager initialized with cleanup job');
  }

  /**
   * Atomic state transition - Compare-And-Set pattern
   * Returns true if transition successful, false if race condition detected
   */
  private transitionState(
    callId: string,
    expectedState: CallState,
    newState: CallState
  ): boolean {
    const call = this.calls.get(callId);
    
    if (!call) {
      console.log(`❌ Call ${callId} not found for transition ${expectedState} → ${newState}`);
      return false;
    }

    if (call.state !== expectedState) {
      console.log(`⚠️ Race condition detected: Call ${callId} is ${call.state}, expected ${expectedState}`);
      return false;
    }

    call.state = newState;
    console.log(`✅ Call ${callId} transitioned: ${expectedState} → ${newState}`);
    return true;
  }

  /**
   * Check if user has pending incoming call
   */
  private hasPendingCall(userId: string): boolean {
    for (const call of this.calls.values()) {
      if (call.to === userId && call.state === CallState.PENDING) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get all pending calls for a user (as receiver)
   */
  private getPendingCallsFor(userId: string): PendingCall[] {
    const result: PendingCall[] = [];
    for (const call of this.calls.values()) {
      if (call.to === userId && call.state === CallState.PENDING) {
        result.push(call);
      }
    }
    return result;
  }

  /**
   * Handle user calling another user
   */
  handleCallUser(
    callId: string,
    fromUserId: string,
    fromName: string,
    targetUserId: string
  ): { success: boolean; error?: string; canRetry?: boolean } {
    // 1. Check if target user exists
    const targetUser = UserManager.getUser(targetUserId);
    if (!targetUser) {
      return { success: false, error: 'User not found' };
    }

    // 2. Check if target user is already in a call
    if (targetUser.status === UserStatus.IN_CALL) {
      return { 
        success: false, 
        error: 'User is busy', 
        canRetry: false 
      };
    }

    // 3. Check if target user already has a pending call
    if (this.hasPendingCall(targetUserId)) {
      return { 
        success: false, 
        error: 'User has another incoming call', 
        canRetry: true 
      };
    }

    // 4. Create pending call
    const call: PendingCall = {
      callId,
      state: CallState.PENDING,
      from: fromUserId,
      fromName,
      to: targetUserId,
      toName: targetUser.name,
      timestamp: Date.now(),
    };

    this.calls.set(callId, call);
    console.log(`📞 Call created: ${fromName} → ${targetUser.name} (${callId})`);

    // 5. Notify target user
    if (this.io) {
      this.io.to(targetUser.socketId).emit('incomingCallNew', {
        callId,
        from: fromUserId,
        fromName,
      });
      console.log(`📨 Sent incomingCallNew to ${targetUser.name}`);
    }

    return { success: true };
  }

  /**
   * Handle user accepting a call
   */
  async handleAcceptCall(
    callId: string,
    acceptorUserId: string
  ): Promise<{ success: boolean; roomId?: string; error?: string }> {
    const call = this.calls.get(callId);

    if (!call) {
      return { success: false, error: 'Call not found' };
    }

    // Verify acceptor is the correct recipient
    if (call.to !== acceptorUserId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Atomic transition: PENDING → ACCEPTED
    const transitionSuccess = this.transitionState(
      callId,
      CallState.PENDING,
      CallState.ACCEPTED
    );

    if (!transitionSuccess) {
      return { 
        success: false, 
        error: 'Call no longer available (may have been cancelled or timed out)' 
      };
    }

    try {
      // Auto-reject all other pending calls to this user
      const otherCalls = this.getPendingCallsFor(acceptorUserId).filter(
        c => c.callId !== callId
      );

      for (const otherCall of otherCalls) {
        const rejected = this.transitionState(
          otherCall.callId,
          CallState.PENDING,
          CallState.REJECTED
        );

        if (rejected && this.io) {
          const fromUser = UserManager.getUser(otherCall.from);
          if (fromUser) {
            this.io.to(fromUser.socketId).emit('callRejected', {
              callId: otherCall.callId,
              reason: 'User accepted another call',
            });
          }
          this.calls.delete(otherCall.callId);
        }
      }

      // Create room for the call
      const room = await RoomManager.createRoom(
        call.from,
        call.fromName,
        RoomType.DIRECT,
        undefined
      );

      call.roomId = room.roomId;

      // Update user statuses
      await UserManager.setUserStatus(call.from, UserStatus.IN_CALL);
      await UserManager.setUserRoom(call.from, room.roomId);
      await UserManager.setUserStatus(call.to, UserStatus.IN_CALL);
      await UserManager.setUserRoom(call.to, room.roomId);

      console.log(`✅ Room created for call ${callId}: ${room.roomId}`);

      // Notify both users
      if (this.io) {
        const callerUser = UserManager.getUser(call.from);
        const calleeUser = UserManager.getUser(call.to);

        if (callerUser && calleeUser) {
          // Serialize room data
          const serializedRoom = RoomManager.serializeRoom(room);
          
          // Send to caller
          this.io.to(callerUser.socketId).emit('callAcceptedNew', {
            callId,
            roomId: room.roomId,
            room: serializedRoom,
          });

          // Send to callee
          this.io.to(calleeUser.socketId).emit('callAcceptedNew', {
            callId,
            roomId: room.roomId,
            room: serializedRoom,
          });

          console.log(`📨 Sent callAcceptedNew to both users (room: ${room.roomId})`);
        }
      }

      // Clean up call after successful accept
      setTimeout(() => {
        this.calls.delete(callId);
      }, 1000);

      return { success: true, roomId: room.roomId };
    } catch (error) {
      console.error(`❌ Error accepting call ${callId}:`, error);
      // Rollback state
      call.state = CallState.PENDING;
      return { success: false, error: 'Failed to create room' };
    }
  }

  /**
   * Handle user rejecting a call
   */
  handleRejectCall(
    callId: string,
    rejectorUserId: string,
    reason?: string
  ): { success: boolean; error?: string } {
    const call = this.calls.get(callId);

    if (!call) {
      return { success: false, error: 'Call not found' };
    }

    // Verify rejector is the correct recipient
    if (call.to !== rejectorUserId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Atomic transition: PENDING → REJECTED
    const transitionSuccess = this.transitionState(
      callId,
      CallState.PENDING,
      CallState.REJECTED
    );

    if (!transitionSuccess) {
      return { success: false, error: 'Call no longer available' };
    }

    // Notify caller
    if (this.io) {
      const callerUser = UserManager.getUser(call.from);
      if (callerUser) {
        this.io.to(callerUser.socketId).emit('callRejectedNew', {
          callId,
          reason: reason || 'Call rejected',
        });
        console.log(`📨 Sent callRejectedNew to ${callerUser.name}`);
      }
    }

    // Clean up
    this.calls.delete(callId);
    return { success: true };
  }

  /**
   * Handle caller cancelling a call
   */
  handleCancelCall(
    callId: string,
    cancellerUserId: string
  ): { success: boolean; error?: string } {
    const call = this.calls.get(callId);

    if (!call) {
      return { success: false, error: 'Call not found' };
    }

    // Verify canceller is the caller
    if (call.from !== cancellerUserId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Atomic transition: PENDING → CANCELLED
    const transitionSuccess = this.transitionState(
      callId,
      CallState.PENDING,
      CallState.CANCELLED
    );

    if (!transitionSuccess) {
      return { success: false, error: 'Call no longer available' };
    }

    // Notify callee
    if (this.io) {
      const calleeUser = UserManager.getUser(call.to);
      if (calleeUser) {
        this.io.to(calleeUser.socketId).emit('callCancelled', {
          callId,
        });
        console.log(`📨 Sent callCancelled to ${calleeUser.name}`);
      }
    }

    // Clean up
    this.calls.delete(callId);
    return { success: true };
  }

  /**
   * Background job to clean up timed-out calls
   */
  private startCleanupJob(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const TIMEOUT_MS = 30000; // 30 seconds

      for (const [callId, call] of this.calls.entries()) {
        if (call.state !== CallState.PENDING) continue;

        if (now - call.timestamp > TIMEOUT_MS) {
          // Atomic transition: PENDING → TIMEOUT
          const success = this.transitionState(
            callId,
            CallState.PENDING,
            CallState.TIMEOUT
          );

          if (success) {
            console.log(`⏱️ Call ${callId} timed out`);

            // Notify caller
            if (this.io) {
              const callerUser = UserManager.getUser(call.from);
              if (callerUser) {
                this.io.to(callerUser.socketId).emit('callTimeout', {
                  callId,
                });
              }

              // Notify callee (remove incoming call notification)
              const calleeUser = UserManager.getUser(call.to);
              if (calleeUser) {
                this.io.to(calleeUser.socketId).emit('callCancelled', {
                  callId,
                });
              }
            }

            this.calls.delete(callId);
          }
        }
      }
    }, 5000); // Run every 5 seconds
  }

  /**
   * Stop cleanup job
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.calls.clear();
    console.log('🛑 CallManager destroyed');
  }

  /**
   * Get call info (for debugging)
   */
  getCall(callId: string): PendingCall | undefined {
    return this.calls.get(callId);
  }

  /**
   * Get all pending calls (for debugging)
   */
  getAllCalls(): PendingCall[] {
    return Array.from(this.calls.values());
  }
}

export default new CallManager();

