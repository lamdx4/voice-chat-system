import { app, BrowserWindow, Menu, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import Store from "electron-store";
import { config } from "dotenv";

// Load .env file for main process
config();

// Fix __dirname for ES modules (when needed)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow: BrowserWindow | null = null;

const isDevelopment = process.env.NODE_ENV === "development";

// Environment configuration - loaded from .env
const SERVER_URL = process.env.VITE_SERVER_URL;
const SERVER_WS_URL = process.env.VITE_SERVER_WS_URL;
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const DEV_SERVER_WS_URL = process.env.VITE_DEV_SERVER_WS_URL;

console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("isDevelopment:", isDevelopment);
console.log("Server URLs:", { SERVER_URL, SERVER_WS_URL });


// Build CSP policy dynamically
const buildCSP = (): string => {
  const connectSources = [
    "'self'",
    SERVER_URL,
    SERVER_WS_URL,
  ];

  // Add dev server URLs in development mode
  if (isDevelopment) {
    connectSources.push(DEV_SERVER_URL, DEV_SERVER_WS_URL);
  }

  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    `connect-src ${connectSources.join(' ')}`,
    "img-src 'self' data: https:",
    "font-src 'self' data:",
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
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  // Show window when ready
  mainWindow.once("ready-to-show", () => {
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
