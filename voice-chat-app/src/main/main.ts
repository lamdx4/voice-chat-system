import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  nativeImage,
  ipcMain,
  Notification,
} from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fs from "fs";
import Store from "electron-store";
import { config } from "dotenv";

// Load .env file for main process
// In production, .env is in resources folder
const envPath = app.isPackaged
  ? path.join(process.resourcesPath, ".env")
  : path.join(process.cwd(), ".env");

console.log("📄 Loading .env from:", envPath);
const envResult = config({ path: envPath });

// Check if .env loaded successfully
if (envResult.error) {
  console.error("❌ Failed to load .env file:", envResult.error.message);
  console.error("💡 Make sure .env exists at:", envPath);
  app.quit();
  process.exit(1);
}

console.log("✅ .env loaded successfully");

// Fix __dirname for ES modules (when needed)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

const isDevelopment = process.env.NODE_ENV === "development";

// Environment configuration - loaded from .env (NO FALLBACKS!)
const SERVER_URL = process.env.VITE_SERVER_URL;
const SERVER_WS_URL = process.env.VITE_SERVER_WS_URL;
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const DEV_SERVER_WS_URL = process.env.VITE_DEV_SERVER_WS_URL;

console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("isDevelopment:", isDevelopment);
console.log("Server URLs:", { SERVER_URL, SERVER_WS_URL });

// Fail-fast: Check required env vars
if (!SERVER_URL || !SERVER_WS_URL) {
  console.error("❌ MISSING REQUIRED ENV VARS:");
  console.error("   VITE_SERVER_URL:", SERVER_URL || "(MISSING)");
  console.error("   VITE_SERVER_WS_URL:", SERVER_WS_URL || "(MISSING)");
  console.error("\n💡 Check .env file at:", envPath);
  app.quit();
  process.exit(1);
}

if (isDevelopment && (!DEV_SERVER_URL || !DEV_SERVER_WS_URL)) {
  console.error("❌ MISSING DEV ENV VARS:");
  console.error("   VITE_DEV_SERVER_URL:", DEV_SERVER_URL || "(MISSING)");
  console.error("   VITE_DEV_SERVER_WS_URL:", DEV_SERVER_WS_URL || "(MISSING)");
  console.error("\n💡 Check .env file at:", envPath);
  app.quit();
  process.exit(1);
}

// Build CSP policy dynamically
const buildCSP = (): string => {
  const connectSources = ["'self'", SERVER_URL, SERVER_WS_URL];

  // Add dev server URLs in development mode
  if (isDevelopment) {
    // Safe: Already validated above
    connectSources.push(DEV_SERVER_URL!, DEV_SERVER_WS_URL!);
  }

  // Filter out undefined values
  const validSources = connectSources.filter(Boolean);

  // Production needs file: protocol for local resources
  const defaultSrc = isDevelopment ? "'self'" : "'self' file:";
  const scriptSrc = isDevelopment
    ? "'self' 'unsafe-inline' 'unsafe-eval'"
    : "'self' 'unsafe-inline' 'unsafe-eval' file:";
  const styleSrc = isDevelopment
    ? "'self' 'unsafe-inline'"
    : "'self' 'unsafe-inline' file:";

  return (
    [
      `default-src ${defaultSrc}`,
      `script-src ${scriptSrc}`,
      `style-src ${styleSrc}`,
      `connect-src ${validSources.join(" ")}`,
      "img-src 'self' data: https: file:",
      "font-src 'self' data: file:",
    ].join("; ") + ";"
  );
};

// Initialize electron-store
const store = new Store({
  name: "voice-chat-app",
  encryptionKey: "voice-chat-encryption-key", // Optional: encrypt sensitive data
});

function createWindow() {
  // Keep menu in development for DevTools access
  if (!isDevelopment) {
    Menu.setApplicationMenu(null);
  }

  // Set app icon
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, "assets/icon.png")
    : path.join(__dirname, "../../assets/icon.png");

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: iconPath, // Set window icon
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      devTools: true, // Enable DevTools in development
    },
    show: false,
    backgroundColor: "#ffffff",
    titleBarStyle: "default",
  });

  // Set Content Security Policy dynamically based on environment
  const cspPolicy = buildCSP();
  console.log("📋 CSP Policy:", cspPolicy);
  console.log("🔧 isDevelopment:", isDevelopment);
  console.log("🌐 ENV vars:", {
    SERVER_URL,
    SERVER_WS_URL,
    DEV_SERVER_URL,
    DEV_SERVER_WS_URL,
  });

  mainWindow.webContents.session.webRequest.onHeadersReceived(
    (details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [cspPolicy],
        },
      });
    }
  );

  // Load the app
  if (isDevelopment) {
    mainWindow.loadURL("http://localhost:5173");
    // Open DevTools automatically in development
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    // Production: load from dist folder
    const indexPath = path.join(__dirname, "../dist/index.html");
    console.log("🚀 Loading app from:", indexPath);
    console.log("📂 __dirname:", __dirname);

    mainWindow.loadFile(indexPath);
  }

  // Debug: Open DevTools on load error
  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription) => {
      console.error("❌ Failed to load:", errorCode, errorDescription);
      mainWindow?.webContents.openDevTools({ mode: "detach" });
    }
  );

  // Debug: Log when DOM is ready
  mainWindow.webContents.on("dom-ready", () => {
    console.log("✅ DOM Ready");
  });

  // Show window when ready
  mainWindow.once("ready-to-show", () => {
    console.log("✅ Window ready to show");
    mainWindow?.show();
  });

  // Handle window close - minimize to tray instead of quit
  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();

      // Show notification on first minimize (optional)
      if (process.platform !== "darwin") {
        const notification = new Notification({
          title: "Voice Chat",
          body: "App is running in the background. Click the tray icon to restore.",
          silent: true,
        });
        notification.show();
      }
      return false;
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createTray() {
  // Try to load tray icon from assets
  const trayIconPaths = [
    // Production: resources folder
    path.join(process.resourcesPath, "assets/tray-icon.png"),
    // Development: project root assets folder
    path.join(__dirname, "../../assets/tray-icon.png"),
    // Fallback: dist-electron parent
    path.join(__dirname, "../assets/tray-icon.png"),
  ];

  // Try each path
  const trayIconPath = trayIconPaths.find((p) => fs.existsSync(p));

  let trayIcon;
  if (trayIconPath) {
    console.log("📌 Using tray icon from:", trayIconPath);
    trayIcon = nativeImage.createFromPath(trayIconPath);
    
    // Resize for optimal tray display (16x16 for best results)
    if (!trayIcon.isEmpty()) {
      trayIcon = trayIcon.resize({ width: 16, height: 16 });
    }
  } else {
    console.log("⚠️ Tray icon not found, using empty icon");
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);

  // Set tray tooltip
  tray.setToolTip("Voice Chat App");

  // Create context menu
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show App",
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    {
      type: "separator",
    },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  console.log("✅ System tray created");
}

// App lifecycle
app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

// Handle before-quit to set isQuitting flag
app.on("before-quit", () => {
  isQuitting = true;
});

// Don't quit app when all windows are closed (we have system tray)
app.on("window-all-closed", () => {
  // Keep app running in background with system tray
  // On macOS, it's common to keep the app running
  // On Windows/Linux, we also keep it running for tray functionality
  console.log("ℹ️ All windows closed, app continues in system tray");
});

// IPC Handlers for electron-store
ipcMain.handle("store:get", (_, key: string) => {
  return store.get(key);
});

ipcMain.handle("store:set", (_, key: string, value: any) => {
  store.set(key, value);
  return true;
});

ipcMain.handle("store:delete", (_, key: string) => {
  store.delete(key);
  return true;
});

ipcMain.handle("store:clear", () => {
  store.clear();
  return true;
});

ipcMain.handle("store:has", (_, key: string) => {
  return store.has(key);
});

// IPC Handler for incoming call notification
ipcMain.on(
  "incoming-call",
  (_, data: { callerName: string; callType: string }) => {
    console.log("📞 Incoming call notification:", data);

    // Show system notification
    const notification = new Notification({
      title: "📞 Incoming Call",
      body: `${data.callerName} is calling you ${
        data.callType === "direct" ? "(Direct Call)" : "(Group Call)"
      }`,
      urgency: "critical", // High priority notification
      silent: false, // Play sound
      timeoutType: "never", // Don't auto-dismiss
    });

    notification.on("click", () => {
      // Bring window to front when notification is clicked
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        if (!mainWindow.isVisible()) mainWindow.show();
        mainWindow.focus();
      }
    });

    notification.show();

    // Also bring window to front automatically
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();

      // Flash/bounce the window to get attention
      if (process.platform === "darwin" && app.dock) {
        app.dock.bounce("critical"); // macOS: Bounce dock icon
      } else if (process.platform === "win32") {
        mainWindow.flashFrame(true); // Windows: Flash taskbar
        // Stop flashing after window gets focus
        mainWindow.once("focus", () => {
          mainWindow?.flashFrame(false);
        });
      }
    }

    // Update tray icon tooltip
    if (tray) {
      tray.setToolTip(`Voice Chat - Incoming call from ${data.callerName}`);

      // Reset tooltip after 10 seconds
      setTimeout(() => {
        tray?.setToolTip("Voice Chat App");
      }, 10000);
    }
  }
);

// IPC Handler to show window from renderer
ipcMain.on("show-window", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
  }
});

// Log store path for debugging
console.log("📦 Electron Store Path:", store.path);
