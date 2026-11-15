import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [localIp, setLocalIp] = useState(window.location.hostname);

  useEffect(() => {
    // Fetch server network IP for accurate LAN QR codes
    fetch('/api/network-ip')
      .then(r => r.json())
      .then(data => {
        if (data.localIp && data.localIp !== 'localhost') {
          setLocalIp(data.localIp);
        }
      })
      .catch(() => {});

    // In local development or LAN, connect to the window's origin
    const newSocket = io(window.location.origin, {
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, connected, localIp }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
