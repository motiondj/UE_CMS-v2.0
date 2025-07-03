import io from 'socket.io-client';

class SocketManager {
  constructor(url) {
    this.url = url;
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.listeners = new Map();
    this.isConnected = false;
  }

  connect() {
    if (this.socket) {
      return this.socket;
    }

    this.socket = io(this.url, {
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      reconnectionDelayMax: 10000,
      timeout: 20000,
    });

    this.setupEventHandlers();
    return this.socket;
  }

  setupEventHandlers() {
    this.socket.on('connect', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      console.log('✅ Socket 연결됨');
      this.emit('connection_status', { connected: true });
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      console.log('❌ Socket 연결 끊김:', reason);
      this.emit('connection_status', { connected: false, reason });
      
      // 의도적인 연결 종료가 아닌 경우 재연결 시도
      if (reason === 'io server disconnect') {
        this.socket.connect();
      }
    });

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      this.reconnectAttempts = attemptNumber;
      console.log(`🔄 재연결 시도 중... (${attemptNumber}/${this.maxReconnectAttempts})`);
      this.emit('reconnect_attempt', { attempt: attemptNumber });
    });

    this.socket.on('reconnect_failed', () => {
      console.error('❌ Socket 재연결 실패');
      this.emit('reconnect_failed', {});
    });

    this.socket.on('error', (error) => {
      console.error('Socket 에러:', error);
      this.emit('socket_error', { error });
    });

    // 기존 리스너 다시 등록
    this.listeners.forEach((handler, event) => {
      this.socket.on(event, handler);
    });
  }

  on(event, handler) {
    if (!this.socket) {
      this.connect();
    }
    
    this.listeners.set(event, handler);
    this.socket.on(event, handler);
  }

  off(event, handler) {
    if (this.socket) {
      this.socket.off(event, handler);
    }
    this.listeners.delete(event);
  }

  emit(event, data) {
    if (this.socket && this.isConnected) {
      this.socket.emit(event, data);
      return true;
    }
    console.warn('Socket이 연결되지 않아 이벤트를 전송할 수 없습니다:', event);
    return false;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.listeners.clear();
    }
  }
}

export default SocketManager; 