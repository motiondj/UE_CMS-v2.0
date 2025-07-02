# 서버 연결 문제 해결 가이드

## 🚨 현재 문제점 정리

1. **서버 종료시 클라이언트도 함께 종료됨**
2. **연결된 클라이언트가 일정시간 후 오프라인으로 변경됨**
3. **클라이언트 재연결 메커니즘 부족**
4. **하트비트 타임아웃 설정 문제**

---

## 🔧 1. 서버 설정 수정 (`config/server.js`)

**기존 문제**: 타임아웃이 너무 짧아서 정상 연결도 끊어짐

```javascript
// config/server.js - 수정할 부분
module.exports = {
  // 모니터링 설정 - 기존보다 관대하게 변경
  monitoring: {
    healthCheckInterval: 30000,    // 30초 (기존: 15초)
    offlineTimeout: 300000,        // 5분 (기존: 2분) - 너무 짧았음
    connectionCheckInterval: 30000, // 30초 (기존: 15초)
    processCheckInterval: 20000,    // 20초 (기존: 10초)
    
    // 새로 추가할 설정들
    maxMissedHeartbeats: 3,        // 3번 놓치면 오프라인
    heartbeatGracePeriod: 60000,   // 1분 여유시간
    reconnectionGracePeriod: 120000 // 2분 재연결 대기
  },
  
  // Socket.IO 설정도 수정
  socket: {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    },
    pingInterval: 30000,  // 30초 (기존: 25초)
    pingTimeout: 120000,  // 2분 (기존: 60초) - 더 관대하게
    transports: ['websocket', 'polling'],
    
    // 새로 추가
    allowEIO3: true,      // 호환성 향상
    maxHttpBufferSize: 1e6, // 1MB
    connectTimeout: 60000   // 1분 연결 타임아웃
  }
};
```

---

## 🔧 2. Socket 서비스 수정 (`services/socketService.js`)

**핵심 수정사항**: 연결 관리 로직 전면 개선

### 2.1 클래스 속성 추가

```javascript
// socketService.js 상단에 추가
class SocketService {
  constructor() {
    this.io = null;
    this.connectedClients = new Map();
    this.clientTimeouts = new Map();
    
    // 새로 추가할 속성들
    this.clientHeartbeats = new Map();     // 하트비트 기록
    this.clientReconnectTimers = new Map(); // 재연결 타이머
    this.gracefulShutdown = false;         // 정상 종료 플래그
  }
```

### 2.2 하트비트 처리 로직 수정

```javascript
// handleHeartbeat 메서드 전체 교체
async handleHeartbeat(socket, data) {
  try {
    const { clientName, ip_address, timestamp } = data;
    const clientIP = ip_address || this.normalizeIP(socket.handshake.address || '127.0.0.1');
    
    logger.info(`하트비트 수신: ${clientName} (${clientIP})`);
    
    // 하트비트 기록 업데이트
    this.clientHeartbeats.set(clientName, {
      lastHeartbeat: new Date(),
      consecutiveMisses: 0,
      clientIP: clientIP
    });
    
    // 재연결 타이머 클리어 (정상 연결됨)
    this.clearReconnectTimer(clientName);
    
    // 소켓 연결 상태 확인
    if (!socket.connected) {
      logger.warn(`하트비트 처리 실패: 소켓이 연결되지 않음 - ${clientName}`);
      return;
    }
    
    // 클라이언트 정보 업데이트
    const client = await ClientModel.updateHeartbeat(clientName, clientIP);
    
    if (client) {
      // 소켓 연결 관리
      this.registerSocket(client.name, socket);
      socket.clientName = client.name;
      
      // 상태 업데이트 (강제로 online 설정)
      await ClientModel.updateStatus(client.id, 'online');
      this.emit('client_status_changed', { 
        id: client.id, 
        name: client.name, 
        status: 'online',
        lastHeartbeat: new Date()
      });
      
      // 하트비트 응답 (클라이언트에게 성공 알림)
      if (socket.connected) {
        socket.emit('heartbeat_response', {
          status: 'ok',
          timestamp: new Date().toISOString(),
          message: '하트비트 수신 완료',
          nextHeartbeatIn: config.monitoring.healthCheckInterval
        });
      }
      
      logger.info(`하트비트 처리 완료: ${client.name}`);
    } else {
      logger.warn(`하트비트 처리 실패: 클라이언트를 찾을 수 없음 - ${clientName}`);
    }
  } catch (error) {
    logger.error('하트비트 처리 실패:', error);
    
    // 오류가 발생해도 클라이언트에게 알림
    if (socket && socket.connected) {
      socket.emit('heartbeat_response', {
        status: 'error',
        timestamp: new Date().toISOString(),
        message: '하트비트 처리 중 오류 발생',
        shouldReconnect: true
      });
    }
  }
}
```

### 2.3 연결 해제 처리 수정

```javascript
// handleDisconnect 메서드 수정
handleDisconnect(socket) {
  const clientType = socket.clientType || 'Unknown';
  const clientName = socket.clientName || 'Unknown';
  
  logger.info(`소켓 연결 해제: ${clientName} (${clientType})`);
  
  if (socket.clientName && !this.gracefulShutdown) {
    // 정상 종료가 아닌 경우에만 재연결 대기 처리
    this.handleClientDisconnect(socket.clientName);
  }
}

// handleClientDisconnect 메서드 수정
handleClientDisconnect(clientName) {
  const currentSocket = this.connectedClients.get(clientName);
  if (currentSocket) {
    this.connectedClients.delete(clientName);
    
    // 재연결 타이머 설정 (더 관대하게)
    const reconnectTimer = setTimeout(async () => {
      try {
        // 재연결되었는지 다시 확인
        const checkSocket = this.connectedClients.get(clientName);
        if (!checkSocket || !checkSocket.connected) {
          
          // 하트비트 기록 확인
          const heartbeatRecord = this.clientHeartbeats.get(clientName);
          if (heartbeatRecord) {
            const timeSinceLastHeartbeat = Date.now() - heartbeatRecord.lastHeartbeat.getTime();
            
            // 하트비트 여유시간 내라면 기다리기
            if (timeSinceLastHeartbeat < config.monitoring.heartbeatGracePeriod) {
              logger.info(`클라이언트 ${clientName}: 하트비트 여유시간 내 - 오프라인 처리 연기`);
              return;
            }
          }
          
          // 정말 오프라인 처리
          const client = await ClientModel.findByName(clientName);
          if (client) {
            await ClientModel.updateStatus(client.id, 'offline');
            this.emit('client_status_changed', { 
              name: clientName, 
              status: 'offline',
              reason: '재연결 타임아웃'
            });
            logger.info(`클라이언트 오프라인 처리 완료: ${clientName}`);
          }
        }
      } catch (error) {
        logger.error(`클라이언트 ${clientName} 오프라인 처리 중 오류:`, error);
      }
    }, config.monitoring.reconnectionGracePeriod); // 2분 대기
    
    this.clientReconnectTimers.set(clientName, reconnectTimer);
  }
}
```

### 2.4 새로운 헬퍼 메서드 추가

```javascript
// 재연결 타이머 관리 메서드들 추가
clearReconnectTimer(clientName) {
  const timer = this.clientReconnectTimers.get(clientName);
  if (timer) {
    clearTimeout(timer);
    this.clientReconnectTimers.delete(clientName);
    logger.debug(`재연결 타이머 클리어: ${clientName}`);
  }
}

// 정상 종료 처리
async gracefulShutdown() {
  logger.info('Socket 서비스 정상 종료 시작...');
  this.gracefulShutdown = true;
  
  // 모든 클라이언트에게 서버 종료 알림
  this.emit('server_shutdown', {
    message: '서버가 종료됩니다. 잠시 후 재연결을 시도해주세요.',
    timestamp: new Date().toISOString(),
    reconnectAfter: 5000 // 5초 후 재연결 권장
  });
  
  // 모든 타이머 정리
  for (const timer of this.clientReconnectTimers.values()) {
    clearTimeout(timer);
  }
  this.clientReconnectTimers.clear();
  
  for (const timeout of this.clientTimeouts.values()) {
    clearTimeout(timeout);
  }
  this.clientTimeouts.clear();
  
  // Socket.IO 서버 정상 종료
  if (this.io) {
    this.io.close(() => {
      logger.info('Socket.IO 서버 종료 완료');
    });
  }
}
```

### 2.5 헬스 체크 로직 수정

```javascript
// startHealthCheck 메서드 수정
startHealthCheck() {
  setInterval(async () => {
    try {
      const onlineClients = await ClientModel.findOnlineClients();
      logger.debug(`온라인 클라이언트 수: ${onlineClients.length}`);
      
      for (const client of onlineClients) {
        if (!client.name) {
          logger.warn(`클라이언트 이름이 없음: ID=${client.id}`);
          continue;
        }
        
        const socket = this.connectedClients.get(client.name);
        const heartbeatRecord = this.clientHeartbeats.get(client.name);
        
        if (socket && socket.connected) {
          // 연결된 클라이언트에게 연결 확인
          logger.debug(`연결 확인 전송: ${client.name}`);
          socket.emit('connection_check', {
            client_name: client.name,
            timestamp: new Date().toISOString(),
            expect_response_within: 30000 // 30초 내 응답 기대
          });
          
        } else if (heartbeatRecord) {
          // 소켓은 없지만 최근 하트비트가 있는 경우
          const timeSinceLastHeartbeat = Date.now() - heartbeatRecord.lastHeartbeat.getTime();
          
          if (timeSinceLastHeartbeat > config.monitoring.offlineTimeout) {
            // 정말 오래된 경우에만 오프라인 처리
            logger.info(`클라이언트 오프라인 처리: ${client.name} (마지막 하트비트: ${Math.round(timeSinceLastHeartbeat/1000)}초 전)`);
            await ClientModel.updateStatus(client.id, 'offline');
            this.emit('client_status_changed', { 
              name: client.name, 
              status: 'offline',
              reason: '하트비트 타임아웃'
            });
            this.clientHeartbeats.delete(client.name);
          }
          
        } else {
          // 소켓도 없고 하트비트 기록도 없는 경우
          logger.info(`클라이언트 오프라인 처리: ${client.name} (연결 기록 없음)`);
          await ClientModel.updateStatus(client.id, 'offline');
          this.emit('client_status_changed', { 
            name: client.name, 
            status: 'offline',
            reason: '연결 없음'
          });
        }
      }
    } catch (error) {
      logger.error('헬스 체크 중 오류:', error);
    }
  }, config.monitoring.connectionCheckInterval);
}
```

---

## 🔧 3. 메인 서버 수정 (`app.js`)

**서버 종료시 클라이언트에게 알림 보내기**

```javascript
// app.js의 Graceful shutdown 부분 수정
process.on('SIGINT', async () => {
  logger.info('서버 종료 시작...');
  
  try {
    // Socket 서비스에게 정상 종료 알림
    await socketService.gracefulShutdown();
    
    // 잠시 대기 (클라이언트들이 알림을 받을 시간)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 서버 종료
    server.close();
    
    // 데이터베이스 연결 종료
    await database.close();
    
    logger.info('서버 정상 종료됨');
    process.exit(0);
  } catch (error) {
    logger.error('서버 종료 중 오류:', error);
    process.exit(1);
  }
});
```

---

## 🔧 4. 클라이언트 모델 수정 (`models/Client.js`)

**오프라인 타임아웃 로직 완전 제거**

```javascript
// Client.js에서 markOfflineByTimeout 메서드 수정
static async markOfflineByTimeout(timeoutMs = 300000) {  // 5분으로 증가
  const cutoffTime = new Date(Date.now() - timeoutMs).toISOString();
  
  // 더 엄격한 조건으로 변경 - 정말 오래된 것만 오프라인 처리
  const result = await db.run(
    `UPDATE clients 
     SET status = "offline" 
     WHERE status = "online" 
     AND last_seen < ? 
     AND last_seen IS NOT NULL`,  // NULL 체크 추가
    [cutoffTime]
  );
  
  logger.info(`하트비트 타임아웃으로 ${result.changes}개 클라이언트 오프라인 처리`);
  return result.changes;
}
```

---

## 🔧 5. 새로운 이벤트 추가

**클라이언트가 받을 수 있는 새로운 이벤트들**

```javascript
// socketService.js에 새로운 이벤트 핸들러 추가

// 서버 재시작 알림
handleConnection(socket) {
  // 기존 코드...
  
  // 서버 상태 알림 이벤트 추가
  socket.on('client_status_request', async (data) => {
    try {
      const { clientName } = data;
      const client = await ClientModel.findByName(clientName);
      
      if (client) {
        socket.emit('server_status_response', {
          serverStatus: 'online',
          clientStatus: client.status,
          timestamp: new Date().toISOString(),
          serverUptime: process.uptime(),
          message: '서버가 정상 동작 중입니다.'
        });
      }
    } catch (error) {
      socket.emit('server_status_response', {
        serverStatus: 'error',
        timestamp: new Date().toISOString(),
        message: '서버 상태 조회 중 오류 발생'
      });
    }
  });
  
  // 재연결 성공 알림
  socket.on('reconnection_success', async (data) => {
    const { clientName } = data;
    logger.info(`클라이언트 재연결 성공: ${clientName}`);
    
    // 재연결 타이머 정리
    this.clearReconnectTimer(clientName);
    
    // 웹 UI에 알림
    this.emit('client_reconnected', {
      clientName: clientName,
      timestamp: new Date().toISOString()
    });
  });
}
```

---

## 🔧 6. 로깅 개선

**더 상세한 로깅으로 문제 추적**

```javascript
// utils/logger.js에 새로운 로그 레벨 추가 또는
// socketService.js에서 더 상세한 로깅

// 연결 상태 변화 시 상세 로깅
emit(event, data) {
  if (this.io) {
    // 클라이언트 상태 변화는 상세히 로깅
    if (event === 'client_status_changed') {
      logger.info(`[STATUS] ${data.name}: ${data.status} (이유: ${data.reason || '없음'})`);
    }
    
    this.io.emit(event, data);
  }
}
```

---

## 🚀 적용 순서

### 1단계: 설정 파일 수정
1. `config/server.js` 타임아웃 설정 수정

### 2단계: Socket 서비스 수정  
1. `services/socketService.js` 하트비트 로직 수정
2. 재연결 타이머 로직 추가
3. 정상 종료 처리 추가

### 3단계: 메인 서버 수정
1. `app.js` graceful shutdown 수정

### 4단계: 테스트
1. 서버 재시작 테스트
2. 클라이언트 연결/재연결 테스트  
3. 하트비트 정상 동작 확인

---

## 🧪 테스트 방법

### 1. 서버 재시작 테스트
```bash
# 서버 실행
npm start

# 다른 터미널에서 서버 종료
Ctrl+C

# 클라이언트가 계속 실행되고 재연결 시도하는지 확인
```

### 2. 연결 안정성 테스트  
```bash
# 서버 로그에서 확인할 항목들
- "하트비트 수신: clientName" (30초마다)
- "재연결 타이머 클리어: clientName" (재연결시)
- "클라이언트 오프라인 처리" (5분 후에만)
```

이렇게 수정하면 클라이언트가 서버 종료에 영향받지 않고 독립적으로 동작하며, 재연결도 안정적으로 이루어질 것입니다!