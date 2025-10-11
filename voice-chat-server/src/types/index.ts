import { types } from 'mediasoup';

// User types
export enum UserStatus {
  IDLE = 'idle',        // Available for calls
  IN_CALL = 'inCall',   // Currently in a call
}

export interface User {
  userId: string;
  name: string;
  socketId: string;
  currentRoomId?: string;
  status: UserStatus;
  connectedAt: number;
}

// Room types
export enum RoomType {
  DIRECT = 'direct',
  GROUP = 'group',
}

export enum CallStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  ENDED = 'ended',
}

export interface RoomParticipant {
  userId: string;
  name: string;
  socketId: string;
  joinedAt: number;
  isHost: boolean;
  status: 'pending' | 'accepted' | 'rejected' | 'left';
  
  // WebRTC related
  producerTransportId?: string;
  consumerTransportId?: string;
  producers: Map<string, types.Producer>; // kind -> producer
  consumers: Map<string, types.Consumer>; // producerId -> consumer
  
  // Media state
  isMuted: boolean;
  isVideoEnabled: boolean;
  mediaStateUpdatedAt: number;
}

export interface Room {
  roomId: string;
  roomType: RoomType;
  roomName?: string;
  hostId: string;
  hostName: string;
  status: CallStatus;
  participants: Map<string, RoomParticipant>;
  createdAt: number;
  endedAt?: number;
  
  // Host grace period
  hostDisconnectedAt?: number;
  isHostless: boolean;
  
  // Group call invitations
  invitedUserIds?: string[]; // For group calls - users who were invited
  
  // Messages
  messages: ChatMessage[];
}

export interface MessageReaction {
  emoji: string;
  userIds: string[];
  count: number;
}

export interface ChatMessage {
  messageId: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: number;
  replyTo?: {
    messageId: string;
    userName: string;
    content: string;
  };
  reactions?: MessageReaction[];
}

// Redis serializable versions
export interface RoomState {
  roomId: string;
  roomType: RoomType;
  roomName?: string;
  hostId: string;
  hostName: string;
  status: CallStatus;
  participants: ParticipantState[];
  invitedUserIds?: string[];
  createdAt: number;
  endedAt?: number;
  hostDisconnectedAt?: number;
  isHostless: boolean;
  messages: ChatMessage[];
}

export interface ParticipantState {
  userId: string;
  name: string;
  socketId: string;
  joinedAt: number;
  isHost: boolean;
  status: 'pending' | 'accepted' | 'rejected' | 'left';
  producerTransportId?: string;
  consumerTransportId?: string;
  producerIds: string[];
  consumerIds: string[];
}

// Socket event payloads
export interface CreateRoomPayload {
  roomType: RoomType;
  roomName?: string;
  targetUserId?: string; // for direct calls
  invitedUserIds?: string[]; // for group calls
}

export interface JoinRoomPayload {
  roomId: string;
}

export interface LeaveRoomPayload {
  roomId: string;
}

export interface AcceptCallPayload {
  roomId: string;
}

export interface RejectCallPayload {
  roomId: string;
}

export interface SendMessagePayload {
  roomId: string;
  content: string;
  replyTo?: {
    messageId: string;
    userName: string;
    content: string;
  };
}

export interface ReactToMessagePayload {
  roomId: string;
  messageId: string;
  emoji: string;
}

export interface CreateTransportPayload {
  roomId: string;
  direction: 'send' | 'receive';
}

export interface ConnectTransportPayload {
  roomId: string;
  transportId: string;
  dtlsParameters: types.DtlsParameters;
}

export interface ProducePayload {
  roomId: string;
  transportId: string;
  kind: types.MediaKind;
  rtpParameters: types.RtpParameters;
}

export interface ConsumePayload {
  roomId: string;
  producerId: string;
  rtpCapabilities: types.RtpCapabilities;
}

export interface EndCallPayload {
  roomId: string;
}

// Call management types
export enum CallState {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout',
}

export interface PendingCall {
  callId: string;
  state: CallState;
  from: string;      // userId của người gọi
  fromName: string;
  to: string;        // userId của người nhận
  toName: string;
  timestamp: number;
  roomId?: string;   // Chỉ có khi state = ACCEPTED
}

export interface CallUserPayload {
  callId: string;
  targetUserId: string;
}

export interface AcceptCallPayloadNew {
  callId: string;
}

export interface RejectCallPayloadNew {
  callId: string;
  reason?: string;
}

export interface CancelCallPayload {
  callId: string;
}

