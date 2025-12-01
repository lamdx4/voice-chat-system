# Voice Chat System - Symbol Reference Map

**Last Updated:** 2025-11-10
**Purpose:** Quick reference for all classes, methods, events, and types in the codebase

---

## Table of Contents
1. [Backend Classes](#backend-classes)
2. [Backend Socket.IO Events](#backend-socketio-events)
3. [Frontend Components](#frontend-components)
4. [Frontend Services](#frontend-services)
5. [Frontend Stores](#frontend-stores)
6. [Shared Types & Enums](#shared-types--enums)
7. [Constants](#constants)

---

## Backend Classes

### App
**File:** `voice-chat-server/src/app.ts`

**Purpose:** Main application class, Express + Socket.IO + Mediasoup initialization

**Methods:**
- `constructor()` - Initialize Express, HTTP server, Socket.IO
- `setupMiddlewares()` - Configure CORS, JSON parsing, request logging
- `setupRoutes()` - Mount API routes
- `setupSocketIO()` - Initialize SocketHandler
- `startCleanupTask()` - Start grace period cleanup job (10s interval)
- `initialize()` - Initialize MediasoupService, start cleanup task
- `start()` - Start HTTP server, display startup banner
- `shutdown()` - Graceful shutdown: close Socket.IO, HTTP, Mediasoup, Redis

**Dependencies:**
- MediasoupService
- RedisService
- SocketHandler
- RoomManager (via cleanup task)

**Emits:**
- `roomListUpdated` (to all clients during cleanup)
- `callEnded` (when grace period expires)
- `roomHostless` (when room becomes hostless)

---

### MediasoupService
**File:** `voice-chat-server/src/services/MediasoupService.ts`

**Purpose:** Mediasoup worker and router management (singleton)

**Properties:**
- `workers: types.Worker[]` - Worker pool (one per CPU core)
- `routers: Map<roomId, types.Router>` - Room routers
- `nextWorkerIndex: number` - Round-robin index

**Methods:**
- `async initialize()` - Create worker pool
- `getNextWorker()` - Round-robin worker selection
- `async createRouter(roomId)` - Create router for room, assign to worker
- `getRouter(roomId)` - Get router for room
- `deleteRouter(roomId)` - Close and remove router
- `async createWebRtcTransport(router)` - Create WebRTC transport
- `getWorkers()` - Get all workers
- `async close()` - Close all workers and routers

**Dependencies:** None (leaf service)

---

### RedisService
**File:** `voice-chat-server/src/services/RedisService.ts`

**Purpose:** Redis client and state persistence (singleton)

**Properties:**
- `client: Redis` - ioredis client
- `isConnected: boolean` - Connection status

**Methods:**
- `getClient()` - Get Redis client
- `isReady()` - Check connection status
- `async setRoomState(roomId, state)` - Persist room to Redis
- `async getRoomState(roomId)` - Retrieve room from Redis
- `async deleteRoomState(roomId)` - Delete room from Redis
- `async setUserState(userId, state)` - Persist user to Redis
- `async getUserState(userId)` - Retrieve user from Redis
- `async deleteUserState(userId)` - Delete user from Redis
- `async close()` - Close Redis connection

**Dependencies:** None (leaf service)

**Events:**
- `connect` - Redis connected
- `error` - Redis error

---

### UserManager
**File:** `voice-chat-server/src/services/UserManager.ts`

**Purpose:** User registration, online tracking, status management (singleton)

**Properties:**
- `users: Map<userId, User>` - Online users

**Methods:**
- `async addUser(user)` - Register user, persist to Redis
- `async updateUser(userId, updates)` - Update user, persist to Redis
- `async removeUser(userId)` - Remove user, delete from Redis
- `getUser(userId)` - Get user by ID
- `getUserBySocketId(socketId)` - Reverse lookup by socket ID
- `getAllOnlineUsers()` - Get all online users
- `async setUserRoom(userId, roomId)` - Set user's current room
- `async setUserStatus(userId, status)` - Update user status (IDLE | IN_CALL)
- `async restoreFromRedis()` - (Placeholder) Restore users from Redis

**Dependencies:**
- RedisService

---

### TransportManager
**File:** `voice-chat-server/src/services/TransportManager.ts`

**Purpose:** WebRTC transport lifecycle management (singleton)

**Properties:**
- `transports: Map<transportId, WebRtcTransport>` - Active transports

**Methods:**
- `addTransport(transportId, transport)` - Register transport
- `getTransport(transportId)` - Get transport by ID
- `removeTransport(transportId)` - Close and remove transport
- `removeAllTransportsForRoom(roomId)` - (Placeholder) Remove all transports for room
- `closeAll()` - Close all transports

**Dependencies:** None

---

### RoomManager
**File:** `voice-chat-server/src/services/RoomManager.ts`

**Purpose:** Room lifecycle, participant management, host logic (singleton)

**Properties:**
- `rooms: Map<roomId, Room>` - Active rooms
- `gracePeriodChecking: Set<roomId>` - Rooms being checked for grace period

**Methods:**
- `async createRoom(hostId, hostName, roomType, roomName?, invitedUserIds?)` - Create room, create router, add host
- `async getRoom(roomId)` - Get room (with Redis restore fallback)
- `async getAllActiveRooms()` - Get all non-ended rooms
- `async addParticipant(roomId, userId, name, socketId)` - Add user to room
- `async removeParticipant(roomId, userId)` - Remove user, check host disconnect (uses AsyncLock)
- `async acceptCall(roomId, userId, userName)` - Accept call, activate room
- `async rejectCall(roomId, userId)` - Reject call, potentially end room
- `async endCall(roomId)` - End room, cleanup all resources (uses AsyncLock)
- `async addMessage(roomId, userId, userName, content, replyTo?)` - Add chat message
- `async reactToMessage(roomId, messageId, userId, emoji)` - Toggle message reaction
- `async handleHostReconnect(roomId, userId, socketId)` - Host reconnection logic (uses AsyncLock)
- `async checkHostGracePeriod(roomId)` - Check grace period expiry, switch to hostless or end (uses AsyncLock)
- `getActiveRooms()` - Get active + pending rooms
- `getGroupRooms()` - Get active group rooms only
- `serializeRoom(room)` - Serialize room for client transmission

**Private Methods:**
- `async cleanupParticipantResources(participant)` - Close all producers/consumers
- `async saveRoomToRedis(room)` - Persist room to Redis
- `async restoreRoomFromRedis(roomId)` - Restore room from Redis

**Dependencies:**
- RedisService
- MediasoupService
- UserManager
- AsyncLock

**Concurrency:**
- Uses AsyncLock for: `removeParticipant`, `endCall`, `handleHostReconnect`, `checkHostGracePeriod`

---

### CallManager
**File:** `voice-chat-server/src/services/CallManager.ts`

**Purpose:** Direct call state machine (PENDING → ACCEPTED/REJECTED/CANCELLED/TIMEOUT) (singleton)

**Properties:**
- `calls: Map<callId, PendingCall>` - Active calls
- `io: Server | null` - Socket.IO server reference
- `cleanupInterval: NodeJS.Timeout | null` - Cleanup job handle

**Methods:**
- `initialize(io)` - Set Socket.IO reference, start cleanup job
- `handleCallUser(callId, fromUserId, fromName, targetUserId)` - Initiate call, check user status
- `async handleAcceptCall(callId, acceptorUserId)` - Accept call, create room, transition state
- `handleRejectCall(callId, rejectorUserId, reason?)` - Reject call, notify caller
- `handleCancelCall(callId, cancellerUserId)` - Cancel call, notify callee
- `getCall(callId)` - Get call info (debugging)
- `getAllCalls()` - Get all calls (debugging)
- `destroy()` - Stop cleanup job, clear calls

**Private Methods:**
- `transitionState(callId, expectedState, newState)` - Atomic state transition (CAS pattern)
- `hasPendingCall(userId)` - Check if user has pending incoming call
- `getPendingCallsFor(userId)` - Get all pending calls for user
- `startCleanupJob()` - Background job to timeout calls (5s interval, 30s timeout)

**Dependencies:**
- UserManager
- RoomManager
- Socket.IO Server

**Emits:**
- `incomingCallNew` (to callee)
- `callAcceptedNew` (to both parties)
- `callRejectedNew` (to caller)
- `callCancelled` (to callee)
- `callTimeout` (to caller)

**Concurrency:**
- Uses Compare-And-Set (CAS) pattern for state transitions

---

### SocketHandler
**File:** `voice-chat-server/src/handlers/SocketHandler.ts`

**Purpose:** Socket.IO event orchestration and broadcasting

**Properties:**
- `roomProducers: Map<roomId, Map<userId, Producer[]>>` - Track producers per room/user

**Methods:**
- `initialize(io)` - Setup middleware, connection handler, event listeners
- *Private event handlers (25+ methods):*
  - `handleCreateRoom(socket, io)`
  - `handleJoinRoom(socket, io)`
  - `handleLeaveRoom(socket, io)`
  - `handleAcceptCall(socket, io)`
  - `handleRejectCall(socket, io)`
  - `handleCallUser(socket)`
  - `handleAcceptCallNew(socket)`
  - `handleRejectCallNew(socket)`
  - `handleCancelCall(socket)`
  - `handleEndCall(socket, io)`
  - `handleSendMessage(socket, io)`
  - `handleReactToMessage(socket, io)`
  - `handleGetRooms(socket)`
  - `handleGetOnlineUsers(socket)`
  - `handleGetRouterRtpCapabilities(socket)`
  - `handleCreateTransport(socket)`
  - `handleConnectTransport(socket)`
  - `handleProduce(socket, io)`
  - `handleConsume(socket)`
  - `handleResumeConsumer(socket)`
  - `handleMediaStateChanged(socket, io)`
  - `handleDisconnect(socket, io)`
- *Helper methods:*
  - `userLeaveRoom(userId, roomId, socket, io)` - Extract user leave logic
  - `broadcastRoomList(io)` - Broadcast room list to all
  - `broadcastOnlineUsers(io)` - Broadcast online users to all
  - `serializeRoom(room)` - Serialize room for client

**Dependencies:**
- MediasoupService
- UserManager
- RoomManager
- TransportManager
- CallManager

**Listens to (Client → Server):**
- `connection`
- `disconnect`
- `createRoom`
- `joinRoom`
- `leaveRoom`
- `acceptCall`
- `rejectCall`
- `callUser`
- `acceptCallNew`
- `rejectCallNew`
- `cancelCall`
- `endCall`
- `sendMessage`
- `reactToMessage`
- `getRooms`
- `getOnlineUsers`
- `getRouterRtpCapabilities`
- `createTransport`
- `connectTransport`
- `produce`
- `consume`
- `resumeConsumer`
- `mediaStateChanged`

**Emits (Server → Client):**
- `roomListUpdated` (broadcast)
- `onlineUsersUpdated` (broadcast)
- `incomingCall` (to target user, group calls)
- `incomingCallNew` (to callee, direct calls)
- `callAccepted` (to room)
- `callAcceptedNew` (via CallManager)
- `callRejected` (to room)
- `callRejectedNew` (via CallManager)
- `callCancelled` (via CallManager)
- `callTimeout` (via CallManager)
- `callEnded` (to room)
- `userJoined` (to room)
- `userLeft` (to room)
- `newMessage` (to room)
- `messageReactionUpdated` (to room)
- `newProducer` (to room)
- `participantMediaStateUpdated` (to room)

---

### AsyncLock
**File:** `voice-chat-server/src/utils/AsyncLock.ts`

**Purpose:** Simple async mutex lock for preventing race conditions (singleton)

**Properties:**
- `locks: Map<key, Promise<void>>` - Active locks

**Methods:**
- `async acquire(key)` - Acquire lock, return release function
- `async run<T>(key, fn)` - Execute function with automatic lock/release

**Dependencies:** None

**Usage:** RoomManager uses for critical sections

---

### API Routes
**File:** `voice-chat-server/src/routes/api.ts`

**Endpoints:**
- `GET /api/health` - Health check (returns Redis status, Mediasoup workers)
- `GET /api/info` - Server info (version, uptime, workers)
- `GET /api/rooms` - Get all active rooms
- `GET /api/rooms/:roomId` - Get specific room details
- `GET /api/users/online` - Get all online users

**Dependencies:**
- RoomManager
- UserManager
- MediasoupService
- RedisService

---

## Backend Socket.IO Events

### Client → Server Events

| Event | Payload Type | Handler | Description |
|-------|-------------|---------|-------------|
| `connection` | `{userId, name}` (auth) | `SocketHandler.initialize` | User authentication & registration |
| `disconnect` | - | `SocketHandler.handleDisconnect` | User cleanup, leave room |
| `createRoom` | `CreateRoomPayload` | `SocketHandler.handleCreateRoom` | Create group/direct room |
| `joinRoom` | `JoinRoomPayload` | `SocketHandler.handleJoinRoom` | Join existing room |
| `leaveRoom` | `LeaveRoomPayload` | `SocketHandler.handleLeaveRoom` | Leave room |
| `acceptCall` | `AcceptCallPayload` | `SocketHandler.handleAcceptCall` | Accept group call invitation |
| `rejectCall` | `RejectCallPayload` | `SocketHandler.handleRejectCall` | Reject group call invitation |
| `callUser` | `CallUserPayload` | `SocketHandler.handleCallUser` | Initiate direct call (new flow) |
| `acceptCallNew` | `AcceptCallPayloadNew` | `SocketHandler.handleAcceptCallNew` | Accept direct call (new flow) |
| `rejectCallNew` | `RejectCallPayloadNew` | `SocketHandler.handleRejectCallNew` | Reject direct call (new flow) |
| `cancelCall` | `CancelCallPayload` | `SocketHandler.handleCancelCall` | Cancel outgoing call |
| `endCall` | `EndCallPayload` | `SocketHandler.handleEndCall` | End call (host/hostless) |
| `sendMessage` | `SendMessagePayload` | `SocketHandler.handleSendMessage` | Send chat message |
| `reactToMessage` | `ReactToMessagePayload` | `SocketHandler.handleReactToMessage` | React to message |
| `getRooms` | - | `SocketHandler.handleGetRooms` | Request room list |
| `getOnlineUsers` | - | `SocketHandler.handleGetOnlineUsers` | Request online users |
| `getRouterRtpCapabilities` | `{roomId}` | `SocketHandler.handleGetRouterRtpCapabilities` | Get RTP capabilities |
| `createTransport` | `CreateTransportPayload` | `SocketHandler.handleCreateTransport` | Create WebRTC transport |
| `connectTransport` | `ConnectTransportPayload` | `SocketHandler.handleConnectTransport` | Connect transport |
| `produce` | `ProducePayload` | `SocketHandler.handleProduce` | Produce audio/video |
| `consume` | `ConsumePayload` | `SocketHandler.handleConsume` | Consume peer media |
| `resumeConsumer` | `{roomId, consumerId}` | `SocketHandler.handleResumeConsumer` | Resume consumer |
| `mediaStateChanged` | `{roomId, isMuted, isVideoEnabled}` | `SocketHandler.handleMediaStateChanged` | Update media state |

### Server → Client Events

| Event | Payload Type | Emitter | Description |
|-------|-------------|---------|-------------|
| `roomListUpdated` | `RoomListUpdatedEvent` | SocketHandler, App | Broadcast room list |
| `onlineUsersUpdated` | `OnlineUsersUpdatedEvent` | SocketHandler | Broadcast online users |
| `incomingCall` | `IncomingCallEvent` | SocketHandler | Group call invitation |
| `incomingCallNew` | `IncomingCallEventNew` | CallManager | Direct call invitation (new flow) |
| `callAccepted` | `CallAcceptedEvent` | SocketHandler | Group call accepted |
| `callAcceptedNew` | `CallAcceptedEventNew` | CallManager | Direct call accepted (new flow) |
| `callRejected` | `CallRejectedEvent` | SocketHandler | Group call rejected |
| `callRejectedNew` | `CallRejectedEventNew` | CallManager | Direct call rejected (new flow) |
| `callCancelled` | `CallCancelledEvent` | CallManager | Call cancelled by caller |
| `callTimeout` | `CallTimeoutEvent` | CallManager | Call timeout (30s) |
| `callEnded` | `CallEndedEvent` | SocketHandler, App | Call ended by host/hostless |
| `userJoined` | `UserJoinedEvent` | SocketHandler | User joined room |
| `userLeft` | `UserLeftEvent` | SocketHandler | User left room |
| `newMessage` | `NewMessageEvent` | SocketHandler | New chat message |
| `messageReactionUpdated` | `{messageId, reactions[]}` | SocketHandler | Message reaction updated |
| `newProducer` | `NewProducerEvent` | SocketHandler | Peer produced media |
| `participantMediaStateUpdated` | `{userId, name, isMuted, isVideoEnabled}` | SocketHandler | Peer media state changed |
| `roomHostless` | `{roomId, message}` | App | Room became hostless |

---

## Frontend Components

### Main Components

#### App
**File:** `voice-chat-app/src/renderer/App.tsx`

**Purpose:** Root component, routing, socket connection

**Hooks:**
- `useSocketConnection()` - Initialize socket connection
- `useUserStore()` - Get user state
- `useVoiceChatStore()` - Get voice chat state

**Child Components:**
- InitUser (if no user)
- Dashboard (if user, not in call)
- CallRoom (if in call)
- IncomingCall (if incoming call)
- OutgoingCall (if outgoing call)
- Toaster (notifications)

---

#### Dashboard
**File:** `voice-chat-app/src/renderer/components/Dashboard.tsx`

**Purpose:** Main dashboard with online users, rooms, settings

**Child Components:**
- OnlineUsers
- RoomList
- CreateRoomDialog
- DebugPanel
- DeviceSelector

---

#### CallRoom
**File:** `voice-chat-app/src/renderer/components/CallRoom.tsx`

**Purpose:** Main call room UI with participants, controls, chat

**State:**
- Local media state (muted, video enabled)
- WebRTC setup progress

**Methods:**
- `setupWebRTC()` - Initialize device, transports, produce media
- `handleLeaveCall()` - Leave room, cleanup WebRTC
- `handleToggleMute()` - Toggle audio
- `handleToggleVideo()` - Toggle video

**Child Components:**
- ParticipantGrid
- ParticipantSidebar
- ChatMessage
- ResizableSidePanel

---

#### ParticipantGrid
**File:** `voice-chat-app/src/renderer/components/ParticipantGrid.tsx`

**Purpose:** Grid layout for participant video tiles

**Features:**
- Auto-layout based on participant count
- Self-view (local video)
- Peer videos with audio

**Child Components:**
- ParticipantCard (for each participant)

---

#### ParticipantCard
**File:** `voice-chat-app/src/renderer/components/ParticipantCard.tsx`

**Purpose:** Individual participant tile with video, audio, state indicators

**Props:**
- `participant: Participant`
- `isLocal: boolean`

**Features:**
- Video track rendering
- Audio track rendering (hidden)
- Mute/video state indicators
- Name display

---

#### OnlineUsers
**File:** `voice-chat-app/src/renderer/components/OnlineUsers.tsx`

**Purpose:** List of online users with call buttons

**Features:**
- User list
- Call button for direct calls
- Status indicators (IDLE | IN_CALL)

---

#### RoomList
**File:** `voice-chat-app/src/renderer/components/RoomList.tsx`

**Purpose:** List of available group rooms

**Features:**
- Room list with participant count
- Join button
- Host indicator
- Hostless indicator

---

#### CreateRoomDialog
**File:** `voice-chat-app/src/renderer/components/CreateRoomDialog.tsx`

**Purpose:** Modal for creating group rooms

**Features:**
- Room name input
- User selection (multi-select)
- Create button

---

#### IncomingCall
**File:** `voice-chat-app/src/renderer/components/IncomingCall.tsx`

**Purpose:** Incoming call notification with accept/reject buttons

**Props:**
- `incomingCall: IncomingCall`

**Features:**
- Caller name
- Accept button
- Reject button
- Ringing sound

---

#### OutgoingCall
**File:** `voice-chat-app/src/renderer/components/OutgoingCall.tsx`

**Purpose:** Outgoing call indicator with cancel button

**Props:**
- `outgoingCall: OutgoingCall`

**Features:**
- Callee name
- Cancel button
- Calling sound
- Timeout indicator

---

#### ChatMessage
**File:** `voice-chat-app/src/renderer/components/ChatMessage.tsx`

**Purpose:** Chat message display with reactions

**Props:**
- `message: ChatMessage`

**Features:**
- Message content
- Timestamp
- Reactions
- Reply indicator

---

#### InitUser
**File:** `voice-chat-app/src/renderer/components/InitUser.tsx`

**Purpose:** User initialization screen (set name)

**Features:**
- Name input
- Submit button
- Persist to electron-store

---

### UI Components (Radix UI)

All in `voice-chat-app/src/renderer/components/ui/`:
- Avatar
- Badge
- Button
- Card
- Checkbox
- Dialog
- Dropdown Menu
- Input
- Label
- Scroll Area
- Separator
- Sonner (Toast)
- Textarea

---

## Frontend Services

### socketService
**File:** `voice-chat-app/src/renderer/services/socket.ts`

**Purpose:** Socket.IO client wrapper, event management (singleton)

**Properties:**
- `socket: Socket | null` - Socket.IO client instance
- `serverUrl: string` - Server URL from env

**Methods:**
- `connect()` - Connect to server with auth (userId, name)
- `disconnect()` - Disconnect from server
- `setupEventListeners()` - Setup all event listeners
- **Emit methods (20+):**
  - `createRoom(payload, callback)`
  - `joinRoom(payload, callback)`
  - `leaveRoom(payload, callback)`
  - `acceptCall(payload, callback)`
  - `rejectCall(payload, callback)`
  - `callUser(payload, callback)`
  - `acceptCallNew(payload, callback)`
  - `rejectCallNew(payload, callback)`
  - `cancelCall(payload, callback)`
  - `endCall(payload, callback)`
  - `sendMessage(payload, callback)`
  - `reactToMessage(payload, callback)`
  - `getRooms(callback)`
  - `getOnlineUsers(callback)`
  - `getRouterRtpCapabilities(roomId)`
  - `createTransport(roomId, direction)`
  - `connectTransport(roomId, transportId, dtlsParameters)`
  - `produce(roomId, transportId, kind, rtpParameters)`
  - `consume(roomId, producerId, rtpCapabilities)`
  - `resumeConsumer(roomId, consumerId)`
  - `mediaStateChanged(roomId, isMuted, isVideoEnabled)`

**Event Listeners (Server → Client):**
- `connect`, `reconnect`, `disconnect`
- `connect_error`, `reconnect_attempt`, `reconnect_error`, `reconnect_failed`
- `incomingCall` → `voiceChatStore.setIncomingCall`
- `incomingCallNew` → `voiceChatStore.setIncomingCallNew`
- `callAccepted` (no action)
- `callAcceptedNew` → `voiceChatStore.setCurrentRoom`
- `callRejected` → `voiceChatStore.setIncomingCall(null)`
- `callRejectedNew` → Show toast, clear outgoing call
- `callCancelled` → Clear incoming call
- `callTimeout` → Clear outgoing call, show toast
- `callEnded` → `voiceChatStore.leaveRoom`
- `userJoined` → `voiceChatStore.addParticipant`
- `userLeft` → `voiceChatStore.removeParticipant`
- `newMessage` → `voiceChatStore.addMessage`
- `messageReactionUpdated` → `voiceChatStore.updateMessageReactions`
- `newProducer` → `webrtcService.consume`
- `participantMediaStateUpdated` → `voiceChatStore.updateParticipant`
- `roomListUpdated` → `voiceChatStore.setAvailableRooms`
- `onlineUsersUpdated` → `voiceChatStore.setOnlineUsers`

**Dependencies:**
- voiceChatStore
- userStore
- webrtcService (dynamic import)

---

### webrtcService (WebRTCService)
**File:** `voice-chat-app/src/renderer/lib/mediasoup.ts`

**Purpose:** Mediasoup client wrapper, WebRTC management (singleton)

**Properties:**
- `device: Device | null` - Mediasoup device
- `sendTransport: Transport | null` - Send transport
- `recvTransport: Transport | null` - Receive transport
- `producers: Map<producerId, Producer>` - Active producers
- `consumers: Map<consumerId, Consumer>` - Active consumers
- `currentRoomId: string | null` - Current room ID
- `pendingProducers: Array<{producerId, userId, kind}>` - Queue for late consumers

**Methods:**
- `async initializeDevice(roomId)` - Load device with RTP capabilities
- `async createSendTransport(roomId)` - Create send transport, setup event handlers
- `async createRecvTransport(roomId)` - Create receive transport, setup event handlers
- `async produce(track)` - Produce audio/video track with codec options
- `async consume(producerId, userId, kind)` - Consume peer track, add to participant
- `async processPendingProducers()` - Process queued producers
- `pauseProducer(kind)` - Pause audio/video producer
- `resumeProducer(kind)` - Resume audio/video producer
- `closeProducer(kind)` - Close audio/video producer
- `closeConsumer(consumerId)` - Close specific consumer
- `cleanup()` - Close all transports, producers, consumers

**Event Handlers:**
- `sendTransport.on('connect')` → `socketService.connectTransport`
- `sendTransport.on('produce')` → `socketService.produce`
- `sendTransport.on('connectionstatechange')` → Log state
- `recvTransport.on('connect')` → `socketService.connectTransport`
- `recvTransport.on('connectionstatechange')` → Log state
- `producer.on('trackended')` → Log ended
- `producer.on('transportclose')` → Log closed
- `consumer.on('trackended')` → Log ended
- `consumer.on('transportclose')` → Log closed

**Dependencies:**
- socketService
- voiceChatStore
- audioDeviceService

---

### audioService
**File:** `voice-chat-app/src/renderer/services/audioService.ts`

**Purpose:** Audio track management, mute/unmute, volume control (singleton)

**Properties:**
- `audioContext: AudioContext | null`
- `gainNode: GainNode | null`
- `audioStream: MediaStream | null`

**Methods:**
- `async getAudioStream(deviceId?)` - Get microphone stream
- `setMuted(muted)` - Enable/disable audio track
- `setVolume(volume)` - Adjust gain (0-1)
- `getVolume()` - Get current volume
- `cleanup()` - Stop all tracks

**Dependencies:** None

---

### audioDeviceService
**File:** `voice-chat-app/src/renderer/services/audioDeviceService.ts`

**Purpose:** Audio device enumeration and selection (singleton)

**Properties:**
- `inputDeviceId: string | null`
- `outputDeviceId: string | null`

**Methods:**
- `async getDevices()` - Enumerate audio input/output devices
- `setInputDevice(deviceId)` - Set microphone
- `setOutputDevice(deviceId)` - Set speaker
- `getInputDevice()` - Get current input device ID
- `getOutputDevice()` - Get current output device ID

**Dependencies:** None

---

## Frontend Stores

### userStore (Zustand)
**File:** `voice-chat-app/src/renderer/stores/userStore.ts`

**Purpose:** User identity and connection status

**State:**
- `userId: string | null` - User UUID
- `name: string | null` - Display name
- `isStoreReady: boolean` - Store initialized flag
- `connectionStatus: 'connecting' | 'connected' | 'disconnected'`

**Actions:**
- `setUserId(userId)` - Set user ID, persist to electron-store
- `setName(name)` - Set name, persist to electron-store
- `setConnectionStatus(status)` - Update connection status
- `initialize()` - Load from electron-store
- `reset()` - Clear all state

**Persistence:** electron-store (key: `user`)

---

### voiceChatStore (Zustand)
**File:** `voice-chat-app/src/renderer/stores/voiceChatStore.ts`

**Purpose:** Voice chat state (rooms, participants, calls, messages, media)

**State:**
- **Socket:** `isSocketConnected: boolean`
- **Rooms:** `currentRoom: Room | null`, `availableRooms: Room[]`
- **Users:** `onlineUsers: User[]`
- **Participants:** `participants: Map<userId, Participant>`
- **Media:** `isMuted: boolean`, `isVideoEnabled: boolean`, `localAudioTrack: MediaStreamTrack | null`, `localVideoTrack: MediaStreamTrack | null`
- **Messages:** `messages: ChatMessage[]`
- **Calls (Old):** `incomingCall: IncomingCallEvent | null`
- **Calls (New):** `outgoingCall: OutgoingCall | null`, `incomingCallNew: IncomingCall | null`, `callTimeout: NodeJS.Timeout | null`

**Actions (30+):**
- **Socket:** `setSocketConnected(connected)`
- **Rooms:** `setAvailableRooms(rooms)`, `setCurrentRoom(room)`, `updateCurrentRoom(updates)`
- **Users:** `setOnlineUsers(users)`
- **Participants:** `addParticipant(participant)`, `removeParticipant(userId)`, `updateParticipant(userId, updates)`, `clearParticipants()`
- **Messages:** `addMessage(message)`, `clearMessages()`, `updateMessageReactions(messageId, reactions)`
- **Media:** `setMuted(muted)`, `setVideoEnabled(enabled)`, `setLocalAudioTrack(track)`, `setLocalVideoTrack(track)`
- **Calls (Old):** `setIncomingCall(call)`
- **Calls (New):** `setOutgoingCall(call)`, `setIncomingCallNew(call)`, `setCallTimeout(timeout)`, `clearCallTimeout()`
- **Reset:** `reset()`, `leaveRoom()`

**Persistence:** None (volatile state)

---

## Shared Types & Enums

### Backend Types
**File:** `voice-chat-server/src/types/index.ts`

**Enums:**
- `UserStatus` - IDLE | IN_CALL
- `RoomType` - DIRECT | GROUP
- `CallStatus` - PENDING | ACTIVE | ENDED
- `CallState` - PENDING | ACCEPTED | REJECTED | CANCELLED | TIMEOUT

**Interfaces:**
- `User` - User identity and status
- `RoomParticipant` - Participant in room with WebRTC state
- `Room` - Room metadata and participants
- `RoomState` - Redis-serializable room state
- `ParticipantState` - Redis-serializable participant state
- `ChatMessage` - Chat message with reactions
- `MessageReaction` - Emoji reaction with user list
- `PendingCall` - Call state machine entry

**Socket Payloads (Client → Server):**
- `CreateRoomPayload`
- `JoinRoomPayload`
- `LeaveRoomPayload`
- `AcceptCallPayload`
- `RejectCallPayload`
- `SendMessagePayload`
- `ReactToMessagePayload`
- `CreateTransportPayload`
- `ConnectTransportPayload`
- `ProducePayload`
- `ConsumePayload`
- `EndCallPayload`
- `CallUserPayload`
- `AcceptCallPayloadNew`
- `RejectCallPayloadNew`
- `CancelCallPayload`

---

### Frontend Types
**File:** `voice-chat-app/src/renderer/types/index.ts`

**Enums:**
- `RoomType` - DIRECT | GROUP
- `ParticipantStatus` - PENDING | ACCEPTED | REJECTED
- `RoomStatus` - PENDING | ACTIVE | ENDED
- `UserStatus` - IDLE | IN_CALL
- `CallState` - PENDING | ACCEPTED | REJECTED | CANCELLED | TIMEOUT

**Interfaces:**
- `User` - User identity and status
- `Participant` - Participant with client-side tracks (audioTrack, videoTrack)
- `Room` - Room metadata with participants array
- `ChatMessage` - Chat message with reactions
- `MessageReaction` - Emoji reaction with user list
- `OutgoingCall` - Outgoing call state
- `IncomingCall` - Incoming call state

**Socket Payloads (Client → Server):**
- Same as backend payloads

**Socket Events (Server → Client):**
- `IncomingCallEvent`
- `IncomingCallEventNew`
- `UserJoinedEvent`
- `UserLeftEvent`
- `CallAcceptedEvent`
- `CallAcceptedEventNew`
- `CallRejectedEvent`
- `CallRejectedEventNew`
- `CallCancelledEvent`
- `CallTimeoutEvent`
- `CallFailedEvent`
- `CallEndedEvent`
- `NewMessageEvent`
- `NewProducerEvent`
- `RoomListUpdatedEvent`
- `OnlineUsersUpdatedEvent`

---

## Constants

### Backend Constants
**File:** `voice-chat-server/src/config/constants.ts`

```typescript
HOST_GRACE_PERIOD = 30 * 1000               // 30 seconds
CLEANUP_CHECK_INTERVAL = 10 * 1000          // 10 seconds
ENABLE_HOSTLESS_MODE = true                 // Enable hostless mode
MAX_GROUP_PARTICIPANTS = 50                 // Max users in group call
MAX_DIRECT_PARTICIPANTS = 2                 // Always 2 for direct calls
```

### Backend Config
**File:** `voice-chat-server/src/config/config.ts`

**Environment Variables:**
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - development | production
- `REDIS_HOST` - Redis host (default: localhost)
- `REDIS_PORT` - Redis port (default: 6379)
- `REDIS_PASSWORD` - Redis password (optional)
- `MEDIASOUP_ANNOUNCED_IP` - Server LAN IP for WebRTC
- `MEDIASOUP_NUM_WORKERS` - Worker count (default: CPU cores)
- `RTC_MIN_PORT` - Min RTC port (default: 10000)
- `RTC_MAX_PORT` - Max RTC port (default: 10100)

**Mediasoup Config:**
- Worker log level: `warn`
- Audio codec: Opus (48kHz, stereo)
- Video codecs: VP8 (90kHz), H264 (90kHz)
- Initial bitrate: 1 Mbps

### Frontend Config
**File:** `voice-chat-app/src/config/env.ts`

```typescript
SERVER_URL = process.env.VITE_SERVER_URL || 'http://localhost:3000'
```

---

## Quick Reference: Key Flows

### 1. User Connects
```
1. socketService.connect()
2. Socket emits 'connection' with auth
3. SocketHandler → UserManager.addUser()
4. Server broadcasts 'onlineUsersUpdated'
5. Client receives → voiceChatStore.setOnlineUsers()
```

### 2. Create Group Room
```
1. UI → socketService.createRoom({roomType: 'group', roomName, invitedUserIds})
2. Server → RoomManager.createRoom() → MediasoupService.createRouter()
3. Server broadcasts 'roomListUpdated'
4. Server emits 'incomingCall' to invited users
5. Client receives → voiceChatStore.setIncomingCall()
```

### 3. Direct Call (New Flow)
```
1. UI → socketService.callUser({callId, targetUserId})
2. Server → CallManager.handleCallUser() → Check user status
3. Server emits 'incomingCallNew' to callee
4. Client receives → voiceChatStore.setIncomingCallNew()
5. Callee accepts → socketService.acceptCallNew({callId})
6. Server → CallManager.handleAcceptCall() → RoomManager.createRoom()
7. Server emits 'callAcceptedNew' to both parties
8. Clients receive → voiceChatStore.setCurrentRoom()
```

### 4. WebRTC Setup
```
1. webrtcService.initializeDevice(roomId)
   → socketService.getRouterRtpCapabilities(roomId)
   → device.load({routerRtpCapabilities})

2. webrtcService.createSendTransport(roomId)
   → socketService.createTransport(roomId, 'send')
   → device.createSendTransport(params)

3. webrtcService.createRecvTransport(roomId)
   → socketService.createTransport(roomId, 'receive')
   → device.createRecvTransport(params)

4. webrtcService.produce(audioTrack)
   → sendTransport.produce({track, codecOptions})
   → socketService.produce() [triggered by transport]
   → Server broadcasts 'newProducer'

5. Peers receive 'newProducer'
   → webrtcService.consume(producerId, userId, kind)
   → socketService.consume()
   → recvTransport.consume(params)
   → Add track to participant
```

### 5. Leave Room
```
1. UI → socketService.leaveRoom({roomId})
2. Server → RoomManager.removeParticipant()
3. Server → Check if host disconnected → Grace period logic
4. Server emits 'userLeft' to room
5. Clients receive → voiceChatStore.removeParticipant()
6. Client → webrtcService.cleanup()
```

---

**End of Symbol Map**

*For detailed architecture, see [ARCHITECTURE_DETAIL.md](./ARCHITECTURE_DETAIL.md)*
*For high-level overview, see [CODEMAP.md](./CODEMAP.md)*