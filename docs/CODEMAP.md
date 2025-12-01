# Voice Chat System - Code Map

## Project Overview

**Voice Chat System** is a full-stack real-time voice and video communication application consisting of two main packages:
- **voice-chat-app** - Desktop client (Electron + React + TypeScript)
- **voice-chat-server** - WebRTC SFU server (Node.js + Express + Mediasoup)

The system supports both group calls (up to 50 participants) and 1-1 direct calls with in-call text chat, built on a Selective Forwarding Unit (SFU) architecture for efficient media routing.

---

## Repository Structure

```
voice-chat/
├── voice-chat-app/          # Electron desktop client
├── voice-chat-server/       # WebRTC signaling & media server
├── requirement.sh           # System requirements script
└── README.md
```

---

## 1. voice-chat-app (Desktop Client)

### Project Type
**Electron + React + TypeScript Desktop Application**

### Key Technologies
- **Runtime:** Electron 38.x
- **UI Framework:** React 19.x with TypeScript
- **Build Tool:** Vite 7.x
- **State Management:** Zustand 5.x
- **UI Components:** Radix UI + TailwindCSS 3.x
- **WebRTC Client:** mediasoup-client 3.16.x
- **Real-time:** Socket.IO Client 4.8.x
- **Local Storage:** electron-store 11.x

### Directory Structure

```
voice-chat-app/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── main.ts             # Main process entry, window management, IPC
│   │   ├── preload.ts          # Preload script, exposes IPC to renderer
│   │   └── resourceManager.ts   # Resource path management
│   ├── renderer/                # React renderer process
│   │   ├── App.tsx             # Root component
│   │   ├── main.tsx            # Renderer entry point
│   │   ├── components/         # React components
│   │   │   ├── CallRoom.tsx           # Main call room UI
│   │   │   ├── ParticipantGrid.tsx    # Video grid layout
│   │   │   ├── ParticipantSidebar.tsx # Participant list
│   │   │   ├── OnlineUsers.tsx        # Online users list
│   │   │   ├── RoomList.tsx           # Available rooms
│   │   │   ├── CreateRoomDialog.tsx   # Room creation modal
│   │   │   ├── IncomingCall.tsx       # Incoming call notification
│   │   │   ├── OutgoingCall.tsx       # Outgoing call UI
│   │   │   ├── ChatMessage.tsx        # Chat message component
│   │   │   ├── ResizableSidePanel.tsx # Resizable panel
│   │   │   └── ui/                    # Radix UI components
│   │   ├── stores/             # Zustand state stores
│   │   │   ├── index.ts               # Store exports
│   │   │   ├── userStore.ts           # User state (UUID, name)
│   │   │   └── voiceChatStore.ts      # Call state, rooms, participants
│   │   ├── services/           # Business logic services
│   │   │   ├── socket.ts              # Socket.IO client, event handlers
│   │   │   ├── audioService.ts        # Audio management (mute, volume)
│   │   │   └── audioDeviceService.ts  # Device selection
│   │   ├── lib/                # Utilities
│   │   │   ├── mediasoup.ts           # Mediasoup client setup
│   │   │   ├── storage.ts             # electron-store wrapper
│   │   │   └── utils.ts               # Helper functions
│   │   ├── hooks/              # Custom React hooks
│   │   │   └── useSocketConnection.ts # Socket connection hook
│   │   ├── styles/             # Global CSS
│   │   └── types/              # TypeScript types
│   ├── components/             # Shared UI components
│   │   └── ui/                        # shadcn/ui components
│   ├── config/
│   │   └── env.ts              # Environment config
│   └── assets/                 # Static assets
├── build/                      # Electron builder resources (icons, installer)
├── resources/                  # App resources (configs, sounds)
├── assets/                     # App assets (icon, tray icon)
├── index.html                  # HTML entry point
├── vite.config.ts             # Vite configuration
├── tailwind.config.js         # TailwindCSS config
├── tsconfig.json              # TypeScript config (React renderer)
├── tsconfig.node.json         # TypeScript config (Node/Electron)
├── components.json            # shadcn/ui config
└── package.json
```

### Entry Points

**Main Process:**
- [src/main/main.ts](../voice-chat-app/src/main/main.ts) - Electron main process, creates BrowserWindow, manages app lifecycle

**Renderer Process:**
- [src/renderer/main.tsx](../voice-chat-app/src/renderer/main.tsx) - React app entry, renders App.tsx
- [src/renderer/App.tsx](../voice-chat-app/src/renderer/App.tsx) - Root component with socket connection and routing

### Build & Development Commands

```bash
# Development (renderer only)
npm run dev

# Electron development
npm run electron:dev

# Build TypeScript + Vite
npm run build

# Build Electron app for all platforms
npm run electron:build

# Platform-specific builds
npm run electron:build:win
npm run electron:build:mac
npm run electron:build:linux

# Setup build environment
npm run setup:build
```

### Key Features

1. **State Management (Zustand)**
   - `userStore` - Manages userId (UUID), name, connection status
   - `voiceChatStore` - Manages rooms, participants, calls, chat messages

2. **Socket.IO Integration**
   - Connection management with auto-reconnect
   - Real-time event handlers for calls, rooms, users
   - Located in [src/renderer/services/socket.ts](../voice-chat-app/src/renderer/services/socket.ts)

3. **WebRTC (Mediasoup Client)**
   - Create send/receive transports
   - Produce audio/video streams
   - Consume peer streams
   - Located in [src/renderer/lib/mediasoup.ts](../voice-chat-app/src/renderer/lib/mediasoup.ts)

4. **Audio Management**
   - Device selection (input/output)
   - Mute/unmute controls
   - Volume adjustment
   - Located in [src/renderer/services/audioService.ts](../voice-chat-app/src/renderer/services/audioService.ts)

5. **Electron Features**
   - System tray integration
   - Window management
   - Local storage (electron-store)
   - Resource bundling

### Dependencies Breakdown

**Core:**
- `react`, `react-dom` - UI framework
- `electron` - Desktop runtime
- `mediasoup-client` - WebRTC SFU client
- `socket.io-client` - Real-time signaling

**State & Storage:**
- `zustand` - State management
- `electron-store` - Persistent local storage

**UI Components:**
- `@radix-ui/*` - Accessible component primitives
- `tailwindcss` - Utility-first CSS
- `lucide-react` - Icons
- `emoji-picker-react` - Emoji picker
- `sonner` - Toast notifications

**Build Tools:**
- `vite` - Build tool and dev server
- `vite-plugin-electron` - Electron integration
- `electron-builder` - Package and distribute

---

## 2. voice-chat-server (Backend Server)

### Project Type
**Node.js + TypeScript WebRTC SFU Server**

### Key Technologies
- **Runtime:** Node.js 18+ with TypeScript 5.3.x
- **Framework:** Express.js 4.x
- **Real-time:** Socket.IO 4.6.x
- **Media Server:** Mediasoup 3.12.x (SFU)
- **State Storage:** Redis (ioredis 5.3.x)
- **CORS:** cors 2.x

### Directory Structure

```
voice-chat-server/
├── src/
│   ├── index.ts                # Entry point, starts app
│   ├── app.ts                  # Express app setup, server initialization
│   ├── config/
│   │   ├── config.ts          # Environment configuration
│   │   └── constants.ts       # App constants (grace period, limits)
│   ├── types/
│   │   └── index.ts           # TypeScript interfaces (Room, User, etc.)
│   ├── services/              # Core business logic
│   │   ├── MediasoupService.ts    # Mediasoup worker/router management
│   │   ├── RedisService.ts        # Redis client & state persistence
│   │   ├── RoomManager.ts         # Room lifecycle, host logic
│   │   ├── UserManager.ts         # User tracking, online status
│   │   ├── TransportManager.ts    # WebRTC transport management
│   │   └── CallManager.ts         # Call state management
│   ├── handlers/
│   │   └── SocketHandler.ts   # Socket.IO event handlers (join, leave, etc.)
│   ├── routes/
│   │   └── api.ts             # REST API endpoints
│   ├── utils/
│   │   ├── cpuUtils.ts        # CPU core detection
│   │   ├── AsyncLock.ts       # Async mutex lock
│   │   └── IpLan.ts           # LAN IP detection
│   └── cli/                   # CLI tools (optional)
├── docker-compose.yml          # Redis Docker setup
├── tsconfig.json              # TypeScript config
├── nodemon.json               # Nodemon dev config
└── package.json
```

### Entry Point

- [src/index.ts](../voice-chat-server/src/index.ts) - Entry point, instantiates App, handles graceful shutdown
- [src/app.ts](../voice-chat-server/src/app.ts) - Express app, Socket.IO setup, Mediasoup initialization

### Build & Development Commands

```bash
# Development with hot reload
npm run dev

# Build TypeScript to dist/
npm run build

# Run production build
npm run start

# Clean build artifacts
npm run clean
```

### Key Architecture

#### Services Layer

1. **MediasoupService** ([src/services/MediasoupService.ts](../voice-chat-server/src/services/MediasoupService.ts))
   - Creates and manages Mediasoup workers (multi-core)
   - Creates routers for each room
   - Configures codecs (Opus audio, VP8/H264 video)

2. **RedisService** ([src/services/RedisService.ts](../voice-chat-server/src/services/RedisService.ts))
   - Redis client initialization
   - State persistence (rooms, users, messages)
   - Key patterns: `user:{userId}`, `room:{roomId}`

3. **RoomManager** ([src/services/RoomManager.ts](../voice-chat-server/src/services/RoomManager.ts))
   - Room creation (group/direct)
   - Participant management
   - Host disconnection & grace period (30s)
   - Hostless mode logic
   - Room cleanup

4. **UserManager** ([src/services/UserManager.ts](../voice-chat-server/src/services/UserManager.ts))
   - User registration (UUID + name)
   - Online status tracking
   - Socket ID mapping

5. **TransportManager** ([src/services/TransportManager.ts](../voice-chat-server/src/services/TransportManager.ts))
   - WebRTC transport creation (send/receive)
   - DTLS parameters handling
   - Producer/Consumer management

6. **CallManager** ([src/services/CallManager.ts](../voice-chat-server/src/services/CallManager.ts))
   - Call state (ringing, active, ended)
   - Direct call invitations
   - Acceptance/rejection logic

#### Event Handlers

**SocketHandler** ([src/handlers/SocketHandler.ts](../voice-chat-server/src/handlers/SocketHandler.ts))
- Handles all Socket.IO events:
  - `connection` - User authentication, online tracking
  - `createRoom` - Create group/direct room
  - `joinRoom` - Join existing room
  - `acceptCall` / `rejectCall` - Direct call flow
  - `leaveRoom` - Leave room
  - `endCall` - End call (host/hostless)
  - `sendMessage` - In-call chat
  - WebRTC signaling: `getRouterRtpCapabilities`, `createTransport`, `connectTransport`, `produce`, `consume`, `resumeConsumer`
  - `disconnect` - Cleanup on disconnect

#### REST API

**Routes** ([src/routes/api.ts](../voice-chat-server/src/routes/api.ts))
- `GET /api/health` - Health check
- `GET /api/info` - Server info
- `GET /api/rooms` - Active rooms
- `GET /api/rooms/:roomId` - Room details
- `GET /api/users/online` - Online users

### Configuration

**Environment Variables** (.env)
```env
PORT=3000
NODE_ENV=development
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
MEDIASOUP_ANNOUNCED_IP=192.168.1.100  # LAN IP
MEDIASOUP_NUM_WORKERS=4
RTC_MIN_PORT=10000
RTC_MAX_PORT=10100
```

**Constants** ([src/config/constants.ts](../voice-chat-server/src/config/constants.ts))
- `HOST_GRACE_PERIOD` - 30 seconds
- `CLEANUP_CHECK_INTERVAL` - 10 seconds
- `ENABLE_HOSTLESS_MODE` - true
- `MAX_GROUP_PARTICIPANTS` - 50
- `MAX_DIRECT_PARTICIPANTS` - 2

### Key Features

1. **Host Management**
   - Host disconnection triggers 30s grace period
   - Room continues during grace period
   - On expiry: becomes hostless (if enabled) or closes
   - Host can reconnect and regain control

2. **Hostless Mode**
   - Room continues without host if participants exist
   - Any participant can end the call
   - Prevents premature room closure

3. **Redis State Persistence**
   - All room/user state stored in Redis
   - Survives server restarts
   - Supports distributed deployments

4. **Mediasoup SFU Architecture**
   - Selective Forwarding Unit (not MCU/mesh)
   - Efficient bandwidth usage
   - Multi-core worker distribution
   - Codec negotiation (Opus, VP8, H264)

5. **Real-time Updates**
   - Room list updates (`roomListUpdated`)
   - Online users updates (`onlineUsersUpdated`)
   - Participant join/leave notifications
   - New media producer notifications

### Dependencies Breakdown

**Core:**
- `express` - HTTP server
- `socket.io` - Real-time signaling
- `mediasoup` - WebRTC SFU
- `ioredis` - Redis client
- `cors` - CORS middleware

**Dev Tools:**
- `typescript` - Type safety
- `ts-node` - TypeScript execution
- `nodemon` - Dev hot reload

---

## Communication Flow

### 1. Connection Flow
```
Client                     Server
  |                          |
  |-- Socket.IO Connect ---->|
  |    (auth: userId, name)  |
  |                          |
  |<--- connection success --|
  |<--- onlineUsersUpdated --|
  |<--- roomListUpdated ------|
```

### 2. Group Call Flow
```
Client A                   Server                   Client B
  |                          |                          |
  |-- createRoom (group) --->|                          |
  |<--- room created ---------|                          |
  |                          |                          |
  |                          |<--- joinRoom ------------|
  |<--- userJoined -----------|--- userJoined --------->|
  |                          |                          |
  |-- getRouterRtpCaps ----->|                          |
  |-- createTransport ------>|                          |
  |-- produce (audio) ------>|--- newProducer --------->|
  |                          |<--- consume -------------|
  |<--- consume --------------|-- resumeConsumer ------>|
```

### 3. Direct Call Flow
```
Caller                     Server                   Callee
  |                          |                          |
  |-- createRoom (direct)--->|                          |
  |<--- room created ---------|--- incomingCall ------->|
  |                          |                          |
  |                          |<--- acceptCall ----------|
  |<--- callAccepted ---------|--- callAccepted ------->|
  |                          |                          |
  [WebRTC setup begins]      |    [WebRTC setup begins] |
```

---

## Development Setup

### Prerequisites
- Node.js >= 18.x
- Redis server running
- Yarn or npm

### Server Setup
```bash
cd voice-chat-server
yarn install
cp .env.example .env
# Edit .env with your LAN IP
yarn dev
```

### Client Setup
```bash
cd voice-chat-app
yarn install
cp .env.example .env
# Edit .env with server URL
yarn electron:dev
```

---

## Testing

### Server Health Check
```bash
curl http://localhost:3000/api/health
```

### Client Testing
1. Build and run client: `yarn electron:dev`
2. Enter user name
3. Create or join rooms
4. Test audio/video streams

---

## Build for Production

### Server
```bash
cd voice-chat-server
yarn build
yarn start
```

### Client
```bash
cd voice-chat-app
yarn electron:build           # All platforms
yarn electron:build:win       # Windows
yarn electron:build:mac       # macOS
yarn electron:build:linux     # Linux
```

Built apps appear in `voice-chat-app/release/` directory.

---

## Key Design Decisions

1. **Electron Desktop App**
   - Cross-platform consistency
   - System-level integrations (tray, notifications)
   - Easier audio device management

2. **Mediasoup SFU**
   - Scalable architecture (vs mesh/MCU)
   - Lower bandwidth requirements
   - Better quality for group calls

3. **Zustand State Management**
   - Lightweight, no boilerplate
   - TypeScript-friendly
   - Simple hooks API

4. **Redis State Storage**
   - Fast in-memory storage
   - Persistence for room/user state
   - Enables horizontal scaling

5. **Socket.IO Signaling**
   - Mature library with auto-reconnect
   - Room/namespace support
   - Fallback transports

6. **TypeScript Throughout**
   - Type safety across stack
   - Better IDE support
   - Fewer runtime errors

---

## Further Reading

- [voice-chat-server/README.md](../voice-chat-server/README.md) - Detailed server API docs
- [Mediasoup Documentation](https://mediasoup.org/documentation/)
- [Socket.IO Documentation](https://socket.io/docs/)
- [Electron Documentation](https://www.electronjs.org/docs/)
- [React Documentation](https://react.dev/)

---

**Last Updated:** 2025-11-10
