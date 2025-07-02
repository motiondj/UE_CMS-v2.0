const socketIo = require('socket.io');
const ClientModel = require('../models/Client');
const config = require('../config/server');

class SocketService {
  constructor() {
    this.io = null;
    this.connectedClients = new Map();
    this.clientTimeouts = new Map();
    
    // 새로 추가할 속성들 (문서 2.1 정확히 따름)
    this.clientHeartbeats = new Map();     // 하트비트 기록
    this.clientReconnectTimers = new Map(); // 재연결 타이머
    this.gracefulShutdown = false;         // 정상 종료 플래그
  }

  initialize(server) {
    this.io = socketIo(server, config.socket);
    
    this.io.on('connection', (socket) => {
      const clientIP = this.normalizeIP(socket.handshake.address);
      const isWebUI = clientIP === '127.0.0.1' || clientIP === '::1';
      
      if (isWebUI) {
        console.log(`[DEBUG] 웹 UI 연결: ${socket.id} (IP: ${clientIP})`);
      } else {
        console.log(`[INFO] 클라이언트 연결: ${socket.id} (IP: ${clientIP})`);
      }
      
      this.handleConnection(socket);
    });
    
    // 주기적인 상태 확인
    this.startHealthCheck();
    this.startOfflineCheck();
    
    console.log('[INFO] Socket.IO 서비스 초기화 완료');
  }

  handleConnection(socket) {
    // 클라이언트 등록
    socket.on('register_client', (data) => {
      console.log(`[INFO] 클라이언트 등록 요청 수신: ${socket.id} - ${JSON.stringify(data)}`);
      this.handleRegister(socket, data);
    });
    
    // 하트비트
    socket.on('heartbeat', (data) => {
      console.log(`[INFO] 하트비트 요청 수신: ${socket.id} - ${JSON.stringify(data)}`);
      this.handleHeartbeat(socket, data);
    });
    
    // 프로세스 상태
    socket.on('current_process_status', (data) => this.handleProcessStatus(socket, data));
    socket.on('process_status', (data) => this.handleProcessStatusUpdate(socket, data));
    
    // 실행 결과
    socket.on('execution_result', (data) => this.handleExecutionResult(socket, data));
    socket.on('stop_result', (data) => this.handleStopResult(socket, data));
    
    // 연결 확인 응답
    socket.on('connection_check_response', (data) => {
      this.handleConnectionCheckResponse(socket, data);
    });
    
    // ping 이벤트 (연결 상태 확인용)
    socket.on('ping', (data) => {
      console.log(`[DEBUG] ping 수신: ${socket.id}`);
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });
    
    // 연결 해제
    socket.on('disconnect', (reason) => {
      const clientIP = this.normalizeIP(socket.handshake.address);
      const isWebUI = clientIP === '127.0.0.1' || clientIP === '::1';
      
      if (isWebUI) {
        console.log(`[DEBUG] 웹 UI 연결 해제: ${socket.id} (이유: ${reason})`);
      } else {
        console.log(`[INFO] 클라이언트 연결 해제: ${socket.id} (이유: ${reason})`);
      }
      
      this.handleDisconnect(socket);
    });
    
    // 에러 처리
    socket.on('error', (error) => {
      console.log(`[ERROR] 소켓 에러: ${socket.id} - ${error}`);
    });
    
    // 새로운 이벤트들 추가 (문서 5번 정확히 따름)
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
      console.log(`[INFO] 클라이언트 재연결 성공: ${clientName}`);
      
      // 재연결 타이머 정리
      this.clearReconnectTimer(clientName);
      
      // 웹 UI에 알림
      this.emit('client_reconnected', {
        clientName: clientName,
        timestamp: new Date().toISOString()
      });
    });
  }

  async handleRegister(socket, data) {
    try {
      const { name, clientType = 'python', ip_address } = data;
      const clientIP = ip_address || this.normalizeIP(socket.handshake.address || '127.0.0.1');
      
      socket.clientType = clientType;
      socket.clientName = name;
      
      // 기존 클라이언트 찾기
      let client = await ClientModel.findByIP(clientIP);
      
      if (client) {
        socket.clientName = client.name;
        console.log(`[INFO] 기존 클라이언트 발견: ${client.name} (ID: ${client.id})`);
      } else {
        // 새 클라이언트 등록
        client = await ClientModel.create({ name, ip_address: clientIP });
        console.log(`[INFO] 새 클라이언트 등록: ${name} (ID: ${client.id})`);
      }
      
      // 소켓 연결 관리
      this.registerSocket(client.name, socket);
      
      // 상태 업데이트
      await ClientModel.updateStatus(client.id, 'online');
      this.emit('client_status_changed', { 
        id: client.id, 
        name: client.name, 
        status: 'online' 
      });
      
      // 클라이언트에게 등록 성공 응답 전송
      socket.emit('registration_success', {
        clientId: client.id,
        clientName: client.name,
        message: '클라이언트 등록이 완료되었습니다.'
      });
      
      console.log(`[INFO] 클라이언트 등록 완료 응답 전송: ${client.name}`);
      
    } catch (error) {
      console.log(`[ERROR] 클라이언트 등록 실패:`, error);
      socket.emit('registration_failed', { 
        reason: error.message,
        message: '클라이언트 등록에 실패했습니다.'
      });
    }
  }

  async handleHeartbeat(socket, data) {
    try {
      const { clientName, ip_address, timestamp } = data;
      const clientIP = ip_address || this.normalizeIP(socket.handshake.address || '127.0.0.1');
      
      console.log(`[INFO] 하트비트 수신: ${clientName} (${clientIP})`);
      
      // 하트비트 기록 업데이트 (문서 2.2 정확히 따름)
      this.clientHeartbeats.set(clientName, {
        lastHeartbeat: new Date(),
        consecutiveMisses: 0,
        clientIP: clientIP
      });
      
      // 재연결 타이머 클리어 (정상 연결됨)
      this.clearReconnectTimer(clientName);
      
      // 소켓 연결 상태 확인
      if (!socket.connected) {
        console.log(`[WARN] 하트비트 처리 실패: 소켓이 연결되지 않음 - ${clientName}`);
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
        
        console.log(`[INFO] 하트비트 처리 완료: ${client.name}`);
      } else {
        console.log(`[WARN] 하트비트 처리 실패: 클라이언트를 찾을 수 없음 - ${clientName}`);
      }
    } catch (error) {
      console.log(`[ERROR] 하트비트 처리 실패:`, error);
      
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

  async handleProcessStatus(socket, data) {
    const { clientName, running_process_count, running_processes, status } = data;
    console.log(`[INFO] 프로세스 상태: ${clientName} - ${running_process_count}개 실행 중`);
    
    try {
      const client = await ClientModel.findByName(clientName);
      if (client) {
        const newStatus = running_process_count > 0 ? 'running' : 'online';
        await ClientModel.updateStatus(client.id, newStatus);
        
        this.emit('client_status_changed', {
          id: client.id,
          name: clientName,
          status: newStatus,
          running_process_count,
          running_processes
        });
      }
    } catch (error) {
      console.log(`[ERROR] 프로세스 상태 처리 실패:`, error);
    }
  }

  async handleExecutionResult(socket, data) {
    const { executionId, clientName, status, result } = data;
    console.log(`[INFO] 실행 결과: ${clientName} - ${status}`);
    
    // 실행 히스토리 업데이트
    if (executionId) {
      const ExecutionModel = require('../models/Execution');
      await ExecutionModel.updateStatus(executionId, status, result);
      this.emit('execution_updated', { executionId, status, result });
    }
    
    // 클라이언트 상태 업데이트
    if (clientName) {
      const client = await ClientModel.findByName(clientName);
      if (client) {
        await ClientModel.updateStatus(client.id, 'online');
        this.emit('client_status_changed', { 
          name: clientName, 
          status: 'online',
          reason: '명령 실행 완료'
        });
      }
    }
  }

  async handleProcessStatusUpdate(socket, data) {
    // handleProcessStatus와 동일한 처리
    await this.handleProcessStatus(socket, data);
  }

  async handleStopResult(socket, data) {
    const { clientName, status, result } = data;
    console.log(`[INFO] 중지 결과: ${clientName} - ${status}`);
    
    // 클라이언트 상태 업데이트
    if (clientName) {
      const client = await ClientModel.findByName(clientName);
      if (client) {
        await ClientModel.updateStatus(client.id, 'online');
        this.emit('client_status_changed', { 
          name: clientName, 
          status: 'online',
          reason: '명령 중지 완료'
        });
      }
    }
  }

  async handleConnectionCheckResponse(socket, data) {
    const { clientName, timestamp } = data;
    console.log(`[DEBUG] 연결 확인 응답: ${clientName} - ${timestamp}`);
    
    // 클라이언트가 응답했으므로 온라인 상태 유지
    if (clientName) {
      const client = await ClientModel.findByName(clientName);
      if (client) {
        await ClientModel.updateStatus(client.id, 'online');
        // 하트비트 기록도 업데이트
        this.clientHeartbeats.set(clientName, {
          lastHeartbeat: new Date(),
          consecutiveMisses: 0,
          clientIP: client.ip_address
        });
      }
    }
  }

  handleDisconnect(socket) {
    const clientType = socket.clientType || 'Unknown';
    const clientName = socket.clientName || 'Unknown';
    
    console.log(`[INFO] 소켓 연결 해제: ${clientName} (${clientType})`);
    
    if (socket.clientName && !this.gracefulShutdown) {
      // 정상 종료가 아닌 경우에만 재연결 대기 처리
      this.handleClientDisconnect(socket.clientName);
    }
  }

  handleClientDisconnect(clientName) {
    const currentSocket = this.connectedClients.get(clientName);
    if (currentSocket) {
      this.connectedClients.delete(clientName);
      
      // 재연결 타이머 설정 (더 관대하게) - 문서 2.3 정확히 따름
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
                console.log(`[INFO] 클라이언트 ${clientName}: 하트비트 여유시간 내 - 오프라인 처리 연기`);
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
              console.log(`[INFO] 클라이언트 오프라인 처리 완료: ${clientName}`);
            }
          }
        } catch (error) {
          console.log(`[ERROR] 클라이언트 ${clientName} 오프라인 처리 중 오류:`, error);
        }
      }, config.monitoring.reconnectionGracePeriod); // 2분 대기
      
      this.clientReconnectTimers.set(clientName, reconnectTimer);
    }
  }

  registerSocket(clientName, socket) {
    // 기존 소켓 정리
    this.cleanupSocket(clientName);
    
    // 새 소켓 등록
    this.connectedClients.set(clientName, socket);
    socket.clientName = clientName;
    
    // 타임아웃 클리어
    this.clearTimeout(clientName);
  }

  cleanupSocket(clientName) {
    const oldSocket = this.connectedClients.get(clientName);
    if (oldSocket && oldSocket.connected) {
      oldSocket.disconnect();
    }
    this.connectedClients.delete(clientName);
  }

  clearTimeout(clientName) {
    const timeout = this.clientTimeouts.get(clientName);
    if (timeout) {
      clearTimeout(timeout);
      this.clientTimeouts.delete(clientName);
    }
  }

  // 재연결 타이머 관리 메서드들 추가 (문서 2.4 정확히 따름)
  clearReconnectTimer(clientName) {
    const timer = this.clientReconnectTimers.get(clientName);
    if (timer) {
      clearTimeout(timer);
      this.clientReconnectTimers.delete(clientName);
      console.log(`[DEBUG] 재연결 타이머 클리어: ${clientName}`);
    }
  }

  // 정상 종료 처리 (문서 2.4 정확히 따름)
  async gracefulShutdown() {
    console.log('[INFO] Socket 서비스 정상 종료 시작...');
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
        console.log('[INFO] Socket.IO 서버 종료 완료');
      });
    }
  }

  normalizeIP(ip) {
    if (ip.startsWith('::ffff:')) {
      return ip.substring(7);
    }
    if (ip === '::1') {
      return '127.0.0.1';
    }
    return ip;
  }

  // 외부 호출용 메서드 (문서 6번 정확히 따름)
  emit(event, data) {
    if (this.io) {
      // 클라이언트 상태 변화는 상세히 로깅
      if (event === 'client_status_changed') {
        console.log(`[INFO] [STATUS] ${data.name}: ${data.status} (이유: ${data.reason || '없음'})`);
      }
      
      this.io.emit(event, data);
    }
  }

  emitToClient(clientName, event, data) {
    const socket = this.connectedClients.get(clientName);
    if (socket && socket.connected) {
      socket.emit(event, data);
      return true;
    }
    return false;
  }

  getConnectedClients() {
    return Array.from(this.connectedClients.keys());
  }

  isClientConnected(clientName) {
    const socket = this.connectedClients.get(clientName);
    return socket && socket.connected;
  }

  // 주기적인 상태 확인 (문서 2.5 정확히 따름)
  startHealthCheck() {
    const self = this; // this 컨텍스트 보존
    
    const runHealthCheck = async () => {
      try {
        const onlineClients = await ClientModel.findOnlineClients();
        console.log(`[DEBUG] 온라인 클라이언트 수: ${onlineClients.length}`);
        
        for (const client of onlineClients) {
          if (!client.name) {
            console.warn(`[WARN] 클라이언트 이름이 없음: ID=${client.id}`);
            continue;
          }
          
          const socket = self.connectedClients.get(client.name);
          const heartbeatRecord = self.clientHeartbeats.get(client.name);
          
          if (socket && socket.connected) {
            // 연결된 클라이언트에게 연결 확인
            console.log(`[DEBUG] 연결 확인 전송: ${client.name}`);
            socket.emit('connection_check', {
              clientName: client.name,  // client_name → clientName으로 변경
              timestamp: new Date().toISOString(),
              expect_response_within: 30000 // 30초 내 응답 기대
            });
            
          } else if (heartbeatRecord) {
            // 소켓은 없지만 최근 하트비트가 있는 경우
            const timeSinceLastHeartbeat = Date.now() - heartbeatRecord.lastHeartbeat.getTime();
            
            if (timeSinceLastHeartbeat > config.monitoring.offlineTimeout) {
              // 정말 오래된 경우에만 오프라인 처리
              console.log(`[INFO] 클라이언트 오프라인 처리: ${client.name} (마지막 하트비트: ${Math.round(timeSinceLastHeartbeat/1000)}초 전)`);
              await ClientModel.updateStatus(client.id, 'offline');
              self.emit('client_status_changed', { 
                name: client.name, 
                status: 'offline',
                reason: '하트비트 타임아웃'
              });
              self.clientHeartbeats.delete(client.name);
            }
            
          } else {
            // 소켓도 없고 하트비트 기록도 없는 경우
            console.log(`[INFO] 클라이언트 오프라인 처리: ${client.name} (연결 기록 없음)`);
            await ClientModel.updateStatus(client.id, 'offline');
            self.emit('client_status_changed', { 
              name: client.name, 
              status: 'offline',
              reason: '연결 없음'
            });
          }
        }
      } catch (error) {
        console.error('[ERROR] 헬스 체크 중 오류:', error);
      }
      
      // 다음 실행 예약
      setTimeout(runHealthCheck, config.monitoring.connectionCheckInterval);
    };
    
    // 첫 번째 실행 시작
    runHealthCheck();
  }

  // 오프라인 처리
  startOfflineCheck() {
    const self = this; // this 컨텍스트 보존
    
    const runOfflineCheck = async () => {
      const offlineCount = await ClientModel.markOfflineByTimeout(config.monitoring.offlineTimeout);
      
      if (offlineCount > 0) {
        console.log(`[INFO] ${offlineCount}개 클라이언트를 오프라인으로 변경`);
        self.emit('clients_offline_updated');
      }
      
      // 다음 실행 예약
      setTimeout(runOfflineCheck, config.monitoring.offlineTimeout);
    };
    
    // 첫 번째 실행 시작
    runOfflineCheck();
  }
}

module.exports = new SocketService(); 