// Types matching the server-side types

export enum RoomType {
  DIRECT = 'direct',
  GROUP = 'group',
}

export enum ParticipantStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
}

export enum RoomStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  ENDED = 'ended',
}

export enum UserStatus {
  IDLE = 'idle',
  IN_CALL = 'inCall',
}

export interface User {
  userId: string;
  name: string;
  socketId: string;
  currentRoomId?: string;
  status: UserStatus;
  connectedAt: number;
}

export interface Participant {
  userId: string;
  name: string;
  socketId: string;
  joinedAt: number;
  isHost: boolean;
  status: ParticipantStatus;
  producerTransportId?: string;
  consumerTransportId?: string;
  producerIds: string[];
  consumerIds: string[];
  // Client-side only media state
  audioTrack?: MediaStreamTrack;
  videoTrack?: MediaStreamTrack;
  audioLevel?: number;
  isSpeaking?: boolean;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  localAudioTrack: MediaStreamTrack | null;
  localVideoTrack: MediaStreamTrack | null;
  localScreenTrack: MediaStreamTrack | null;
  isLocal?: boolean;
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

export interface Room {
  roomId: string;
  roomType: RoomType;
  roomName: string;
  hostId: string;
  hostName: string;
  status: RoomStatus;
  participants: Participant[];
  createdAt: number;
  endedAt?: number;
  isHostless: boolean;
  hostDisconnectedAt?: number;
  messages: ChatMessage[];
}

// Socket.IO Events Payloads

export interface CreateRoomPayload {
  roomType: RoomType;
  roomName?: string;
  targetUserId?: string;
  invitedUserIds?: string[];
}

export interface JoinRoomPayload {
  roomId: string;
}

export interface AcceptCallPayload {
  roomId: string;
}

export interface RejectCallPayload {
  roomId: string;
}

export interface LeaveRoomPayload {
  roomId: string;
}

export interface EndCallPayload {
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

export interface GetRouterRtpCapabilitiesPayload {
  roomId: string;
}

export interface CreateTransportPayload {
  roomId: string;
  direction: 'send' | 'receive';
}

export interface ConnectTransportPayload {
  roomId: string;
  transportId: string;
  dtlsParameters: any;
}

export interface ProducePayload {
  roomId: string;
  transportId: string;
  kind: 'audio' | 'video';
  rtpParameters: any;
}

export interface ConsumePayload {
  roomId: string;
  producerId: string;
  rtpCapabilities: any;
}

export interface ResumeConsumerPayload {
  roomId: string;
  consumerId: string;
}

// Server -> Client Events

export interface IncomingCallEvent {
  roomId: string;
  roomType: RoomType;
  fromUserId: string;
  fromUserName: string;
}

export interface IncomingCallEvent {
  roomId: string;
  roomType: RoomType;
  roomName?: string;
  fromUserId: string;
  fromUserName: string;
}

export interface IncomingCallEventNew extends IncomingCallEvent { }

export interface UserJoinedEvent {
  userId: string;
  userName: string;
  socketId: string;
}

export interface UserLeftEvent {
  userId: string;
  roomId: string;
}

export interface CallAcceptedEvent {
  userId: string;
  roomId: string;
}

export interface CallRejectedEvent {
  userId: string;
  userName: string;
  roomId: string;
}

export interface CallEndedEvent {
  roomId: string;
  endedBy: string;
  reason?: string;
}

export interface NewMessageEvent extends ChatMessage { }

export interface NewProducerEvent {
  producerId: string;
  userId: string;
  kind: 'audio' | 'video';
  appData?: any;
}

export interface RoomListUpdatedEvent {
  rooms: Room[];
}

export interface OnlineUsersUpdatedEvent {
  users: User[];
}

// Call Management Types
export enum CallState {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout',
}

export interface OutgoingCall {
  callId: string;
  targetUserId: string;
  targetUserName: string;
  startTime: number;
}

export interface IncomingCall {
  callId: string;
  fromUserId: string;
  fromUserName: string;
  receivedAt: number;
}

// New Call Event Payloads
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

// New Server Events
export interface IncomingCallEventNew {
  callId: string;
  from: string;
  fromName: string;
}

export interface CallAcceptedEventNew {
  callId: string;
  roomId: string;
  room?: Room;
}

export interface CallRejectedEventNew {
  callId: string;
  reason: string;
}

export interface CallCancelledEvent {
  callId: string;
}

export interface CallTimeoutEvent {
  callId: string;
}

export interface CallFailedEvent {
  error: string;
  canRetry?: boolean;
}

