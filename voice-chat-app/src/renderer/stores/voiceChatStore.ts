import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Room, User, Participant, ChatMessage, IncomingCallEvent, OutgoingCall, IncomingCall } from '../types';

interface VoiceChatState {
  // Socket connection
  isSocketConnected: boolean;
  
  // Room state
  currentRoom: Room | null;
  availableRooms: Room[];
  onlineUsers: User[];
  
  // Media state
  isMuted: boolean;
  isVideoEnabled: boolean;
  localAudioTrack: MediaStreamTrack | null;
  localVideoTrack: MediaStreamTrack | null;
  localScreenTrack: MediaStreamTrack | null;
  isScreenSharing: boolean;
  
  // Participants with media tracks
  participants: Map<string, Participant>;
  
  // Messages
  messages: ChatMessage[];
  
  // Old incoming call (for group rooms)
  incomingCall: IncomingCallEvent | null;
  
  // New call management
  outgoingCall: OutgoingCall | null;
  incomingCallNew: IncomingCall | null;
  callTimeout: NodeJS.Timeout | null;
  
  // Actions - Socket
  setSocketConnected: (connected: boolean) => void;
  
  // Actions - Rooms
  setAvailableRooms: (rooms: Room[]) => void;
  setCurrentRoom: (room: Room | null) => void;
  updateCurrentRoom: (updates: Partial<Room>) => void;
  
  // Actions - Users
  setOnlineUsers: (users: User[]) => void;
  
  // Actions - Participants
  addParticipant: (participant: Participant) => void;
  removeParticipant: (userId: string) => void;
  updateParticipant: (userId: string, updates: Partial<Participant>) => void;
  clearParticipants: () => void;
  
  // Actions - Messages
  addMessage: (message: ChatMessage) => void;
  clearMessages: () => void;
  updateMessageReactions: (messageId: string, reactions: any[]) => void;
  
  // Actions - Media
  setMuted: (muted: boolean) => void;
  setVideoEnabled: (enabled: boolean) => void;
  setLocalAudioTrack: (track: MediaStreamTrack | null) => void;
  setLocalVideoTrack: (track: MediaStreamTrack | null) => void;
  setLocalScreenTrack: (track: MediaStreamTrack | null) => void;
  setScreenSharing: (isSharing: boolean) => void;
  
  // Actions - Incoming call (old)
  setIncomingCall: (call: IncomingCallEvent | null) => void;
  
  // Actions - New call management
  setOutgoingCall: (call: OutgoingCall | null) => void;
  setIncomingCallNew: (call: IncomingCall | null) => void;
  setCallTimeout: (timeout: NodeJS.Timeout | null) => void;
  clearCallTimeout: () => void;
  
  // Actions - Reset
  reset: () => void;
  leaveRoom: () => void;
}

const initialState = {
  isSocketConnected: false,
  currentRoom: null,
  availableRooms: [],
  onlineUsers: [],
  isMuted: false,
  isVideoEnabled: false,
  localAudioTrack: null,
  localVideoTrack: null,
  localScreenTrack: null,
  participants: new Map<string, Participant>(),
  messages: [],
  incomingCall: null,
  outgoingCall: null,
  incomingCallNew: null,
  callTimeout: null,
};

export const useVoiceChatStore = create<VoiceChatState>()(
  devtools(
    (set) => ({
      ...initialState,

      setSocketConnected: (connected: boolean) => {
        set({ isSocketConnected: connected });
      },

      setAvailableRooms: (rooms: Room[]) => {
        set({ availableRooms: rooms });
      },

      setCurrentRoom: (room: Room | null) => {
        if (room) {
          // Populate participants from room data
          console.log('🏠 Setting current room with participants:', room.participants);
          const participantsMap = new Map<string, Participant>();
          room.participants.forEach(p => {
            participantsMap.set(p.userId, p);
          });
          set({ currentRoom: room, participants: participantsMap });
        } else {
          set({ currentRoom: room });
        }
      },

      updateCurrentRoom: (updates: Partial<Room>) => {
        set((state) => ({
          currentRoom: state.currentRoom ? { ...state.currentRoom, ...updates } : null,
        }));
      },

      setOnlineUsers: (users: User[]) => {
        set({ onlineUsers: users });
      },

      addParticipant: (participant: Participant) => {
        set((state) => {
          const newParticipants = new Map(state.participants);
          newParticipants.set(participant.userId, participant);
          return { participants: newParticipants };
        });
      },

      removeParticipant: (userId: string) => {
        set((state) => {
          const newParticipants = new Map(state.participants);
          newParticipants.delete(userId);
          return { participants: newParticipants };
        });
      },

      updateParticipant: (userId: string, updates: Partial<Participant>) => {
        console.log('🔄 Updating participant:', userId, updates);
        set((state) => {
          const participant = state.participants.get(userId);
          if (!participant) {
            console.warn('⚠️ Participant not found:', userId);
            return state;
          }

          const updated = { ...participant, ...updates };
          console.log('✅ Participant updated:', updated);
          const newParticipants = new Map(state.participants);
          newParticipants.set(userId, updated);
          return { participants: newParticipants };
        });
      },

      clearParticipants: () => {
        set({ participants: new Map() });
      },

      addMessage: (message: ChatMessage) => {
        set((state) => ({
          messages: [...state.messages, message],
        }));
      },

      clearMessages: () => {
        set({ messages: [] });
      },

      updateMessageReactions: (messageId: string, reactions: any[]) => {
        set((state) => ({
          messages: state.messages.map(msg => 
            msg.messageId === messageId 
              ? { ...msg, reactions }
              : msg
          ),
        }));
      },

      setMuted: (muted: boolean) => {
        set({ isMuted: muted });
      },

      setVideoEnabled: (enabled: boolean) => {
        set({ isVideoEnabled: enabled });
      },

      setLocalAudioTrack: (track: MediaStreamTrack | null) => {
        set({ localAudioTrack: track });
      },

      setLocalVideoTrack: (track: MediaStreamTrack | null) => {
        set({ localVideoTrack: track });
      },

      setLocalScreenTrack: (track: MediaStreamTrack | null) => {
        set({ localScreenTrack: track });
      },

      setScreenSharing: (isSharing: boolean) => {
        set({ isScreenSharing: isSharing });
      },

      setIncomingCall: (call: IncomingCallEvent | null) => {
        set({ incomingCall: call });
      },

      setOutgoingCall: (call: OutgoingCall | null) => {
        set({ outgoingCall: call });
      },

      setIncomingCallNew: (call: IncomingCall | null) => {
        set({ incomingCallNew: call });
      },

      setCallTimeout: (timeout: NodeJS.Timeout | null) => {
        set({ callTimeout: timeout });
      },

      clearCallTimeout: () => {
        set((state) => {
          if (state.callTimeout) {
            clearTimeout(state.callTimeout);
          }
          return { callTimeout: null };
        });
      },

      leaveRoom: () => {
        set({
          currentRoom: null,
          participants: new Map(),
          messages: [],
          localAudioTrack: null,
          localVideoTrack: null,
          localScreenTrack: null,
          isMuted: false,
          isVideoEnabled: false,
          isScreenSharing: false,
        });
      },

      reset: () => {
        set((state) => {
          // Clear any pending timeout
          if (state.callTimeout) {
            clearTimeout(state.callTimeout);
          }
          return initialState;
        });
      },
    }),
    { name: 'VoiceChatStore' }
  )
);

