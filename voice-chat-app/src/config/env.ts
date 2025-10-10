/**
 * Environment configuration
 * Centralized configuration using environment variables
 */

// Server URLs
export const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';
export const SERVER_WS_URL = import.meta.env.VITE_SERVER_WS_URL || 'ws://localhost:3000';

// Development Server URLs (for Vite HMR)
export const DEV_SERVER_URL = import.meta.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
export const DEV_SERVER_WS_URL = import.meta.env.VITE_DEV_SERVER_WS_URL || 'ws://localhost:5173';

// Environment
export const isDevelopment = import.meta.env.MODE === 'development';
export const isProduction = import.meta.env.MODE === 'production';

// Content Security Policy sources
export const getCSPConnectSources = (): string => {
  const sources = [
    "'self'",
    SERVER_URL,
    SERVER_WS_URL,
  ];

  // Add dev server URLs in development mode
  if (isDevelopment) {
    sources.push(DEV_SERVER_URL, DEV_SERVER_WS_URL);
  }

  return sources.join(' ');
};

// Full CSP policy
export const getCSPPolicy = (): string => {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    `connect-src ${getCSPConnectSources()}`,
    "img-src 'self' data: https:",
    "font-src 'self' data:",
  ].join('; ') + ';';
};

export default {
  SERVER_URL,
  SERVER_WS_URL,
  DEV_SERVER_URL,
  DEV_SERVER_WS_URL,
  isDevelopment,
  isProduction,
  getCSPConnectSources,
  getCSPPolicy,
};

