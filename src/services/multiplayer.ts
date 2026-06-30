// src/services/multiplayer.ts
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let serverUrl = '';

// Header bắt buộc để bypass ngrok browser warning
const NGROK_HEADERS = {
  'ngrok-skip-browser-warning': 'true',
};

export const multiplayerService = {
  connect: (url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (socket?.connected) socket.disconnect();
      serverUrl = url;

      socket = io(url, {
        timeout: 8000,
        reconnection: false,
        // Thêm header cho ngrok
        extraHeaders: NGROK_HEADERS,
        // Ưu tiên websocket, fallback polling
        transports: ['websocket', 'polling'],
      });

      socket.on('connect', () => resolve());
      socket.on('connect_error', (err) => reject(err));
    });
  },

  disconnect: () => { socket?.disconnect(); socket = null; },
  isConnected: () => socket?.connected || false,
  getSocket: () => socket,
  getUrl: () => serverUrl,

  emit: (event: string, data?: any) => { socket?.emit(event, data); },
  on: (event: string, cb: (data: any) => void) => { socket?.on(event, cb); },
  off: (event: string, cb?: any) => { socket?.off(event, cb); },
  once: (event: string, cb: (data: any) => void) => { socket?.once(event, cb); },
};

export default multiplayerService;