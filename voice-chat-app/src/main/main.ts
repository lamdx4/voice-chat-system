import { app, BrowserWindow, Menu, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
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
  const connectSources = [
    "'self'",
    SERVER_URL,
    SERVER_WS_URL,
  ];

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

  return [
    `default-src ${defaultSrc}`,
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    `connect-src ${validSources.join(' ')}`,
    "img-src 'self' data: https: file:",
    "font-src 'self' data: file:",
  ].join('; ') + ';';
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

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
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
    DEV_SERVER_WS_URL 
  });
  
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [cspPolicy]
      }
    });
  });

  // Load the app
  if (isDevelopment) {
    mainWindow.loadURL("http://localhost:5173");
    // Open DevTools automatically in development
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // Production: load from dist folder
    const indexPath = path.join(__dirname, "../dist/index.html");
    console.log("🚀 Loading app from:", indexPath);
    console.log("📂 __dirname:", __dirname);
    
    mainWindow.loadFile(indexPath);
  }

  // Debug: Open DevTools on load error
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('❌ Failed to load:', errorCode, errorDescription);
    mainWindow?.webContents.openDevTools({ mode: 'detach' });
  });

  // Debug: Log when DOM is ready
  mainWindow.webContents.on('dom-ready', () => {
    console.log('✅ DOM Ready');
  });

  // Show window when ready
  mainWindow.once("ready-to-show", () => {
    console.log("✅ Window ready to show");
    mainWindow?.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
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

// Log store path for debugging
console.log("📦 Electron Store Path:", store.path);
