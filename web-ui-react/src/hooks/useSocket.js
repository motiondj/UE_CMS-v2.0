import { useState, useEffect, useCallback } from 'react';
import io from 'socket.io-client';

const useSocket = (url) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  useEffect(() => {
    // Socket 생성
    const newSocket = io(url, {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    // 연결 이벤트
    newSocket.on('connect', () => {
      setIsConnected(true);
      setReconnectAttempt(0);
      console.log('✅ Socket.io 연결됨');
    });

    // 연결 끊김 이벤트
    newSocket.on('disconnect', (reason) => {
      setIsConnected(false);
      console.log('❌ Socket.io 연결 끊김:', reason);
    });

    // 재연결 시도
    newSocket.on('reconnect_attempt', (attemptNumber) => {
      setReconnectAttempt(attemptNumber);
      console.log(`🔄 재연결 시도 중... (${attemptNumber}/5)`);
    });

    // 재연결 실패
    newSocket.on('reconnect_failed', () => {
      console.error('❌ Socket.io 재연결 실패');
    });

    setSocket(newSocket);

    // 클린업
    return () => {
      newSocket.close();
    };
  }, [url]);

  // 이벤트 리스너 추가 헬퍼
  const on = useCallback((event, handler) => {
    if (socket) {
      socket.on(event, handler);
      return () => socket.off(event, handler);
    }
  }, [socket]);

  // 이벤트 발송 헬퍼
  const emit = useCallback((event, data) => {
    if (socket && isConnected) {
      socket.emit(event, data);
      return true;
    }
    return false;
  }, [socket, isConnected]);

  return {
    socket,
    isConnected,
    reconnectAttempt,
    on,
    emit,
  };
};

export default useSocket; 