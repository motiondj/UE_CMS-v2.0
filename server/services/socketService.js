const socketIo = require('socket.io');
const ClientModel = require('../models/Client');
const logger = require('../utils/logger');
const config = require('../config/server');

class SocketService {
  constructor() {
    this.io = null;
    this.connectedClients = new Map();
    this.clientTimeouts = new Map();
  }

  initialize(server) {
    this.io = socketIo(server, config.socket);
    
    this.io.on('connection', (socket) => {
      const clientIP = this.normalizeIP(socket.handshake.address);
      const isWebUI = clientIP === '127.0.0.1' || clientIP === '::1';
      
      if (isWebUI) {
        logger.debug(`웹 UI 연결: ${socket.id} (IP: ${clientIP})`);
      } else {
        logger.info(`클라이언트 연결: ${socket.id} (IP: ${clientIP})`);
      }
      
      this.handleConnection(socket);
    });
    
    // 주기적인 상태 확인
    this.startHealthCheck();
    this.startOfflineCheck();
    
    logger.info('Socket.IO 서비스 초기화 완료');
  }

  handleConnection(socket) {
    // 클라이언트 등록
    socket.on('register_client', (data) => {
      logger.info(`클라이언트 등록 요청 수신: ${socket.id} - ${JSON.stringify(data)}`);
      this.handleRegister(socket, data);
    });
    
    // 하트비트
    socket.on('heartbeat', (data) => {
      logger.info(`하트비트 요청 수신: ${socket.id} - ${JSON.stringify(data)}`);
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
      logger.debug(`ping 수신: ${socket.id}`);
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });
    
    // 연결 해제
    socket.on('disconnect', (reason) => {
      const clientIP = this.normalizeIP(socket.handshake.address);
      const isWebUI = clientIP === '127.0.0.1' || clientIP === '::1';
      
      if (isWebUI) {
        logger.debug(`웹 UI 연결 해제: ${socket.id} (이유: ${reason})`);
      } else {
        logger.info(`클라이언트 연결 해제: ${socket.id} (이유: ${reason})`);
      }
      
      this.handleDisconnect(socket);
    });
    
    // 에러 처리
    socket.on('error', (error) => {
      logger.error(`소켓 에러: ${socket.id} - ${error}`);
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
        logger.info(`기존 클라이언트 발견: ${client.name} (ID: ${client.id})`);
      } else {
        // 새 클라이언트 등록
        client = await ClientModel.create({ name, ip_address: clientIP });
        logger.info(`새 클라이언트 등록: ${name} (ID: ${client.id})`);
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
      
      logger.info(`클라이언트 등록 완료 응답 전송: ${client.name}`);
      
    } catch (error) {
      logger.error('클라이언트 등록 실패:', error);
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
      
      logger.info(`하트비트 수신: ${clientName} (${clientIP})`);
      
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
        
        // 상태 업데이트
        await ClientModel.updateStatus(client.id, 'online');
        this.emit('client_status_changed', { 
          id: client.id, 
          name: client.name, 
          status: 'online' 
        });
        
        // 하트비트 응답
        if (socket.connected) {
          socket.emit('heartbeat_response', {
            status: 'ok',
            timestamp: new Date().toISOString(),
            message: '하트비트 수신 완료'
          });
        }
        
        logger.info(`하트비트 처리 완료: ${client.name}`);
      } else {
        logger.warn(`하트비트 처리 실패: 클라이언트를 찾을 수 없음 - ${clientName}`);
      }
    } catch (error) {
      logger.error('하트비트 처리 실패:', error);
      // 오류가 발생해도 소켓 연결은 유지
      if (socket && socket.connected) {
        socket.emit('heartbeat_response', {
          status: 'error',
          timestamp: new Date().toISOString(),
          message: '하트비트 처리 중 오류 발생'
        });
      }
    }
  }

  async handleProcessStatus(socket, data) {
    const { clientName, running_process_count, running_processes, status } = data;
    logger.info(`프로세스 상태: ${clientName} - ${running_process_count}개 실행 중`);
    
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
      logger.error('프로세스 상태 처리 실패:', error);
    }
  }

  async handleExecutionResult(socket, data) {
    const { executionId, clientName, status, result } = data;
    logger.info(`실행 결과: ${clientName} - ${status}`);
    
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
    logger.info(`중지 결과: ${clientName} - ${status}`);
    
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
    logger.info(`연결 확인 응답: ${clientName} - ${timestamp}`);
    
    // 클라이언트가 응답했으므로 온라인 상태 유지
    if (clientName) {
      const client = await ClientModel.findByName(clientName);
      if (client) {
        // 상태와 last_seen 시간을 함께 업데이트
        await ClientModel.updateStatus(client.id, 'online');
        logger.info(`클라이언트 온라인 상태 유지: ${clientName}`);
      }
    }
  }

  handleDisconnect(socket) {
    const clientType = socket.clientType || 'Unknown';
    const clientName = socket.clientName || 'Unknown';
    
    logger.info(`소켓 연결 해제: ${clientName} (${clientType})`);
    
    if (socket.clientName) {
      // 연결 해제 처리
      this.handleClientDisconnect(socket.clientName);
    }
  }

  handleClientDisconnect(clientName) {
    const currentSocket = this.connectedClients.get(clientName);
    if (currentSocket) {
      this.connectedClients.delete(clientName);
      
      // 타임아웃 설정 (재연결 대기)
      const timeout = setTimeout(async () => {
        const checkSocket = this.connectedClients.get(clientName);
        if (!checkSocket || !checkSocket.connected) {
          const client = await ClientModel.findByName(clientName);
          if (client) {
            await ClientModel.updateStatus(client.id, 'offline');
            this.emit('client_status_changed', { 
              name: clientName, 
              status: 'offline' 
            });
          }
        }
      }, 5000); // 5초 대기
      
      this.clientTimeouts.set(clientName, timeout);
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

  normalizeIP(ip) {
    if (ip.startsWith('::ffff:')) {
      return ip.substring(7);
    }
    if (ip === '::1') {
      return '127.0.0.1';
    }
    return ip;
  }

  // 외부 호출용 메서드
  emit(event, data) {
    if (this.io) {
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

  // 주기적인 상태 확인
  startHealthCheck() {
    setInterval(async () => {
      try {
        const onlineClients = await ClientModel.findOnlineClients();
        logger.debug(`온라인 클라이언트 수: ${onlineClients.length}`);
        
        for (const client of onlineClients) {
          logger.debug(`클라이언트 정보: ID=${client.id}, name='${client.name}', status='${client.status}'`);
          
          if (!client.name) {
            logger.warn(`클라이언트 이름이 없음: ID=${client.id}`);
            continue;
          }
          
          const socket = this.connectedClients.get(client.name);
          if (socket && socket.connected) {
            logger.debug(`연결 확인 전송: ${client.name}`);
            socket.emit('connection_check', {
              client_name: client.name,
              timestamp: new Date().toISOString()
            });
          } else {
            // 소켓이 없으면 오프라인 처리
            logger.info(`클라이언트 오프라인 처리: ${client.name} (소켓 없음)`);
            await ClientModel.updateStatus(client.id, 'offline');
            this.emit('client_status_changed', { 
              name: client.name, 
              status: 'offline' 
            });
          }
        }
      } catch (error) {
        logger.error('연결 확인 중 오류:', error);
      }
    }, config.monitoring.connectionCheckInterval);
  }

  // 오프라인 처리 (하트비트 기반)
  startOfflineCheck() {
    setInterval(async () => {
      try {
        const offlineCount = await ClientModel.markOfflineByTimeout(config.monitoring.offlineTimeout);
        
        if (offlineCount > 0) {
          logger.info(`${offlineCount}개 클라이언트를 오프라인으로 변경 (하트비트 타임아웃)`);
          this.emit('clients_offline_updated');
        }
      } catch (error) {
        logger.error('오프라인 체크 중 오류:', error);
      }
    }, config.monitoring.offlineTimeout);
  }
}

module.exports = new SocketService(); 