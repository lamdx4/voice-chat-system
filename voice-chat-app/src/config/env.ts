/**
 * Environment configuration
 * Centralized configuration using environment variables
 */

// Server URLs
export const SERVER_URL = import.meta.env.VITE_SERVER_URL;
export const SERVER_WS_URL = import.meta.env.VITE_SERVER_WS_URL;

// Development Server URLs (for Vite HMR)
export const DEV_SERVER_URL = import.meta.env.VITE_DEV_SERVER_URL;
export const DEV_SERVER_WS_URL = import.meta.env.VITE_DEV_SERVER_WS_URL;

// Environment
export const isDevelopment = import.meta.env.MODE === 'development';
export const isProduction = import.meta.env.MODE === 'production';

export default {
  SERVER_URL,
  SERVER_WS_URL,
  DEV_SERVER_URL,
  DEV_SERVER_WS_URL,
  isDevelopment,
  isProduction,
};

