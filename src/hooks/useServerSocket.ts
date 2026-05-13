import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export function useServerSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socketUrl =
      import.meta.env.PROD
        ? window.location.origin
        : 'http://localhost:3001';

    const newSocket = io(socketUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });

    newSocket.on('connect', () => {
      console.log('Socket connected');
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
      setConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const emit = useCallback(
    (event: string, data?: any) => {
      if (socket && connected) {
        socket.emit(event, data);
      }
    },
    [socket, connected]
  );

  const on = useCallback(
    (event: string, callback: (data: any) => void) => {
      if (socket) {
        socket.on(event, callback);
        return () => socket.off(event, callback);
      }
      return undefined;
    },
    [socket]
  );

  return { socket, connected, emit, on };
}
