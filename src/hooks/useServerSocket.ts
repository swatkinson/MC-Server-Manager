import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

type Unsubscribe = () => void;
type SocketHandler<T> = (data: T) => void;

let sharedSocket: Socket | null = null;
let refCount = 0;

function getSocket(): Socket {
  if (sharedSocket) return sharedSocket;

  const socketUrl = import.meta.env.PROD ? window.location.origin : 'http://localhost:3001';
  sharedSocket = io(socketUrl, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
  });
  return sharedSocket;
}

export interface UseServerSocketResult {
  socket: Socket;
  connected: boolean;
  emit: (event: string, data?: unknown) => void;
  on: <T = unknown>(event: string, callback: SocketHandler<T>) => Unsubscribe;
}

export function useServerSocket(): UseServerSocketResult {
  const socketRef = useRef<Socket>(getSocket());
  const [connected, setConnected] = useState<boolean>(socketRef.current.connected);

  useEffect(() => {
    refCount += 1;
    const socket = socketRef.current;

    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      refCount -= 1;
      if (refCount === 0 && sharedSocket) {
        sharedSocket.close();
        sharedSocket = null;
      }
    };
  }, []);

  const emit = useCallback((event: string, data?: unknown) => {
    if (socketRef.current.connected) {
      socketRef.current.emit(event, data);
    }
  }, []);

  const on = useCallback(
    <T = unknown>(event: string, callback: SocketHandler<T>): Unsubscribe => {
      const socket = socketRef.current;
      socket.on(event, callback as (...args: unknown[]) => void);
      return () => socket.off(event, callback as (...args: unknown[]) => void);
    },
    [],
  );

  return { socket: socketRef.current, connected, emit, on };
}
