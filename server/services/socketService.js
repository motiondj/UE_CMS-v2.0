const socketIo = require('socket.io');
const ClientModel = require('../models/Client');
const config = require('../config/server');
const db = require('../config/database');

class SocketService {
  constructor() {
    this.io = null;
    this.connectedClients = new Map();
    this.clientTimeouts = new Map();
    this.clientHeartbeats = new Map(); // 누락된 부분 추가
  }

  initialize(server) {
    this.io = socketIo(server, config.socket);
    
    this.io.on('connection', (socket) => {
      const clientIP = this.normalizeIP(socket.handshake.address);
      const userAgent = socket.handshake.headers['user-agent'] || '';
      
      // 웹 UI는 localhost IP이면서 브라우저 User-Agent를 가진 경우
      const isWebUI = (clientIP === '127.0.0.1' || clientIP === '::1') && 
                     (userAgent.includes('Mozilla') || userAgent.includes('Chrome') || userAgent.includes('Safari'));
      
      if (isWebUI) {
        console.log(`[DEBUG] 웹 UI 연결: ${socket.id} (IP: ${clientIP}, UA: ${userAgent.substring(0, 50)})`);
        socket.clientType = 'web';
        socket.isWebUI = true;
      } else {
        console.log(`[DEBUG] 클라이언트 연결: ${socket.id} (IP: ${clientIP}, UA: ${userAgent.substring(0, 50)})`);
        socket.clientType = 'python';
        socket.isWebUI = false;
      }
      
      this.handleConnection(socket);
    });
    
    // 주기적인 상태 확인
    this.startHealthCheck();
    this.startOfflineCheck();
    
    console.log('[INFO] Socket.IO 서비스 초기화 완료');
  }

  handleConnection(socket) {
    // 웹 UI와 클라이언트 구분 - User-Agent와 IP를 함께 확인
    const clientIP = this.normalizeIP(socket.handshake.address);
    const userAgent = socket.handshake.headers['user-agent'] || '';
    
    // 웹 UI는 localhost IP이면서 브라우저 User-Agent를 가진 경우
    const isWebUI = (clientIP === '127.0.0.1' || clientIP === '::1') && 
                   (userAgent.includes('Mozilla') || userAgent.includes('Chrome') || userAgent.includes('Safari'));
    
    if (isWebUI) {
      console.log(`[DEBUG] 웹 UI 연결: ${socket.id} (IP: ${clientIP}, UA: ${userAgent.substring(0, 50)})`);
      socket.clientType = 'web';
      socket.isWebUI = true;
    } else {
      console.log(`[DEBUG] 클라이언트 연결: ${socket.id} (IP: ${clientIP}, UA: ${userAgent.substring(0, 50)})`);
      socket.clientType = 'python';
      socket.isWebUI = false;
    }
    
    // 클라이언트 등록 (웹 UI는 등록하지 않음)
    socket.on('register_client', (data) => {
      if (socket.isWebUI) {
        console.log(`[WARN] 웹 UI에서 클라이언트 등록 요청 - 무시: ${socket.id}`);
        return;
      }
      console.log(`[INFO] 클라이언트 등록 요청 수신: ${socket.id} - ${JSON.stringify(data)}`);
      this.handleRegister(socket, data);
    });
    
    // 하트비트 (웹 UI는 하트비트를 보내지 않음)
    socket.on('heartbeat', (data) => {
      if (socket.isWebUI) {
        console.log(`[WARN] 웹 UI에서 하트비트 요청 - 무시: ${socket.id}`);
        return;
      }
      console.log(`[INFO] 하트비트 요청 수신: ${socket.id} - ${JSON.stringify(data)}`);
      this.handleHeartbeat(socket, data);
    });
    
    // 프로세스 상태
    socket.on('current_process_status', (data) => this.handleProcessStatus(socket, data));
    socket.on('process_status', (data) => this.handleProcessStatusUpdate(socket, data));
    
    // 실행 결과
    socket.on('execution_result', (data) => this.handleExecutionResult(socket, data));
    socket.on('stop_result', (data) => this.handleStopResult(socket, data));
    
    // 클라이언트 상태 업데이트
    socket.on('client_status_update', (data) => this.handleClientStatusUpdate(socket, data));
    
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
      const userAgent = socket.handshake.headers['user-agent'] || '';
      const isWebUI = (clientIP === '127.0.0.1' || clientIP === '::1') && 
                     (userAgent.includes('Mozilla') || userAgent.includes('Chrome') || userAgent.includes('Safari'));
      
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
  }

  async handleRegister(socket, data) {
    try {
      const { name, clientType = 'python', ip_address } = data;
      const clientIP = ip_address || this.normalizeIP(socket.handshake.address || '127.0.0.1');
      
      // 클라이언트 이름 정규화 (대문자로 통일)
      const normalizedName = name ? name.toUpperCase() : name;
      
      socket.clientType = clientType;
      socket.clientName = normalizedName;
      
      // 기존 클라이언트 찾기
      let client = await ClientModel.findByIP(clientIP);
      
      if (client) {
        // 기존 클라이언트 이름도 정규화
        const existingNormalizedName = client.name ? client.name.toUpperCase() : client.name;
        socket.clientName = existingNormalizedName;
        console.log(`[INFO] 기존 클라이언트 발견: ${existingNormalizedName} (ID: ${client.id})`);
      } else {
        // 새 클라이언트 등록 (정규화된 이름 사용)
        client = await ClientModel.create({ name: normalizedName, ip_address: clientIP });
        console.log(`[INFO] 새 클라이언트 등록: ${normalizedName} (ID: ${client.id})`);
      }
      
      // 소켓 연결 관리 (정규화된 이름 사용)
      const finalClientName = client.name ? client.name.toUpperCase() : client.name;
      console.log(`[DEBUG] 소켓 등록 시작: ${finalClientName}`);
      this.registerSocket(finalClientName, socket);
      console.log(`[DEBUG] 소켓 등록 완료: ${finalClientName}`);
      console.log(`[DEBUG] 등록 후 연결된 클라이언트: ${Array.from(this.connectedClients.keys())}`);
      
      // 상태 업데이트
      await ClientModel.updateStatus(client.id, 'online');
      this.emit('client_status_changed', { 
        client_id: client.id, // client_id로 통일
        name: finalClientName,    // 정규화된 이름 사용
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
      const { clientName, ip_address } = data;
      
      if (!clientName) {
        console.log(`[WARN] 하트비트에 클라이언트 이름이 없음: ${socket.id}`);
        return;
      }
      
      // 클라이언트 이름 정규화
      const normalizedClientName = clientName.toUpperCase();
      
      // 하트비트 서비스에 전달 (IP 주소 포함)
      const heartbeatService = require('./heartbeatService');
      await heartbeatService.receiveHeartbeat(normalizedClientName, ip_address);
      
      // 클라이언트에게 응답
      socket.emit('heartbeat_response', {
        success: true,
        timestamp: new Date().toISOString(),
        message: '하트비트 수신됨'
      });
      
      console.log(`[INFO] 하트비트 처리 완료: ${clientName}`);
    } catch (error) {
      console.error(`[ERROR] 하트비트 처리 실패: ${error.message}`);
      
      socket.emit('heartbeat_response', {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
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
    const { clientName, presetId, command, result, timestamp } = data;
    console.log(`[INFO] 실행 결과: ${clientName} - 프리셋 ${presetId} - 성공: ${result.get('success', false)}`);
    
    try {
      // 클라이언트 찾기
      const client = await ClientModel.findByName(clientName);
      if (!client) {
        console.log(`[WARN] 클라이언트를 찾을 수 없음: ${clientName}`);
        return;
      }
      
      // 프리셋 정보 찾기
      const PresetModel = require('../models/Preset');
      const preset = await PresetModel.findById(presetId);
      if (!preset) {
        console.log(`[WARN] 프리셋을 찾을 수 없음: ${presetId}`);
        return;
      }
      
      // 실행 결과에 따라 상태 결정
      const success = result.get('success', false);
      const newStatus = success ? 'running' : 'stopped';
      
      // 클라이언트 상태 업데이트
      await ClientModel.updateStatus(client.id, newStatus);
      
      // 프리셋 상태 업데이트
      if (success) {
        // 실행 성공 시 current_preset_id 설정
        await db.run(
          'UPDATE clients SET current_preset_id = ? WHERE id = ?',
          [presetId, client.id]
        );
      } else {
        // 실행 실패 시 current_preset_id 초기화
        await db.run(
          'UPDATE clients SET current_preset_id = NULL WHERE id = ?',
          [client.id]
        );
      }
      
      // 프리셋 상태 변경 이벤트 전송
      this.emit('preset_status_changed', {
        preset_id: presetId,
        preset_name: preset.name,
        client_id: client.id,
        client_name: client.name,
        status: newStatus,
        reason: success ? '실행 완료' : `실행 실패: ${result.get('error', '알 수 없는 오류')}`,
        running_clients: success ? [client.name] : []
      });
      
      // 클라이언트 상태 변경 이벤트 전송
      this.emit('client_status_changed', { 
        client_id: client.id,
        name: client.name,
        status: newStatus,
        reason: success ? '명령 실행 완료' : '명령 실행 실패'
      });
      
      console.log(`[INFO] 프리셋 ${preset.name} 실행 결과 처리 완료: ${newStatus}`);
      
    } catch (error) {
      console.log(`[ERROR] 실행 결과 처리 중 오류:`, error);
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

  async handleClientStatusUpdate(socket, data) {
    try {
      const { clientName, status, reason, timestamp } = data;
      console.log(`[INFO] 클라이언트 상태 업데이트 수신: ${clientName} -> ${status} - ${timestamp}`);
      if (reason) {
        console.log(`[INFO] 상태 변경 이유: ${reason}`);
      }
      
      // 클라이언트 찾기
      const client = await ClientModel.findByName(clientName);
      if (client) {
        // 상태 업데이트
        await ClientModel.updateStatus(client.id, status);
        
        // 비정상 종료로 인한 상태 변경인 경우 프리셋 상태도 업데이트
        if (status === 'online' && reason && reason.includes('비정상 종료')) {
          console.log(`[INFO] 비정상 종료 감지 - 프리셋 상태 업데이트 시작: ${clientName}`);
          
          try {
            // 해당 클라이언트가 실행 중인 프리셋 찾기
            const ExecutionModel = require('../models/Execution');
            const runningExecutions = await ExecutionModel.findByClientId(client.id);
            
            console.log(`[INFO] 실행 중인 프리셋 검색 결과: ${runningExecutions.length}개`);
            
            for (const execution of runningExecutions) {
              console.log(`[INFO] 프리셋 확인: ${execution.preset_name} (상태: ${execution.status})`);
              
              if (execution.status === 'running') {
                // 프리셋 상태를 'stopped'로 변경
                await ExecutionModel.updateStatus(execution.id, 'stopped');
                console.log(`[INFO] 프리셋 상태 업데이트: ${execution.preset_name} -> stopped (비정상 종료)`);
                
                // 프리셋 상태 변경 이벤트 전송
                this.emit('preset_status_changed', {
                  preset_id: execution.preset_id,
                  preset_name: execution.preset_name,
                  client_id: client.id,
                  client_name: client.name,
                  status: 'stopped',
                  reason: '비정상 종료'
                });
                
                console.log(`[INFO] 프리셋 상태 변경 이벤트 전송 완료: ${execution.preset_name}`);
              }
            }
          } catch (error) {
            console.log(`[ERROR] 프리셋 상태 업데이트 중 오류:`, error);
          }
        }
        
        // 상태 변경 이벤트 전송
        this.emit('client_status_changed', { 
          client_id: client.id,
          name: client.name,
          status: status,
          reason: reason || '정상 상태 변경'
        });
        
        console.log(`[INFO] 클라이언트 상태 업데이트 완료: ${clientName} -> ${status}`);
      } else {
        console.log(`[WARN] 클라이언트를 찾을 수 없음: ${clientName}`);
      }
    } catch (error) {
      console.log(`[ERROR] 클라이언트 상태 업데이트 처리 중 오류:`, error);
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
    try {
      this.gracefulShutdown = true;
      
      // 모든 클라이언트에게 종료 알림
      this.io.emit('server_shutdown', {
        message: '서버가 종료됩니다.',
        timestamp: new Date().toISOString()
      });
      
      // 잠시 대기 (클라이언트들이 알림을 받을 시간)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 모든 연결 종료
      this.io.close();
      
      console.log('[INFO] Socket.IO 서비스 정상 종료됨');
    } catch (error) {
      console.error('[ERROR] Socket.IO 서비스 종료 중 오류:', error);
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
        const clientName = data.name || data.client_name || '알 수 없음';
        console.log(`[INFO] [STATUS] ${clientName}: ${data.status} (이유: ${data.reason || '없음'})`);
      }
      
      this.io.emit(event, data);
    }
  }

  emitToClient(clientName, event, data) {
    console.log(`[DEBUG] emitToClient 호출: ${clientName}, 이벤트: ${event}`);
    console.log(`[DEBUG] 현재 연결된 클라이언트: ${Array.from(this.connectedClients.keys())}`);
    
    const socket = this.connectedClients.get(clientName);
    console.log(`[DEBUG] 소켓 찾기 결과: ${clientName} - ${socket ? '찾음' : '없음'}`);
    
    if (socket) {
      console.log(`[DEBUG] 소켓 상태: ${clientName} - Socket ID: ${socket.id}, Connected: ${socket.connected}`);
      
      if (socket.connected) {
        console.log(`[DEBUG] 명령 전송: ${clientName} (Socket ID: ${socket.id})`);
        console.log(`[DEBUG] 전송 데이터: ${JSON.stringify(data)}`);
        socket.emit(event, data);
        return true;
      } else {
        console.log(`[DEBUG] 명령 전송 실패: ${clientName} - 소켓 연결 안됨`);
        return false;
      }
    } else {
      console.log(`[DEBUG] 명령 전송 실패: ${clientName} - 소켓 없음`);
      return false;
    }
  }

  getConnectedClients() {
    return Array.from(this.connectedClients.keys());
  }

  isClientConnected(clientName) {
    const socket = this.connectedClients.get(clientName);
    return socket && socket.connected;
  }

  // IP 주소로 연결된 클라이언트 이름 찾기
  findClientByIP(ipAddress) {
    for (const [clientName, socket] of this.connectedClients) {
      const clientIP = this.normalizeIP(socket.handshake.address);
      if (clientIP === ipAddress) {
        return clientName;
      }
    }
    return null;
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

  // 강제 연결 해제 기능 추가
  forceDisconnectClient(clientName) {
    try {
      const socket = this.connectedClients.get(clientName);
      
      if (socket) {
        console.log(`[INFO] 클라이언트 강제 연결 해제: ${clientName} (Socket ID: ${socket.id})`);
        
        // 클라이언트에게 강제 해제 알림
        socket.emit('force_disconnect', {
          reason: 'server_force_disconnect',
          message: '서버에서 연결을 강제로 해제했습니다.',
          timestamp: new Date().toISOString()
        });
        
        // 잠시 대기 후 소켓 연결 해제
        setTimeout(() => {
          socket.disconnect(true);
          console.log(`[INFO] 클라이언트 소켓 연결 해제 완료: ${clientName}`);
        }, 1000);
        
        return true;
      } else {
        console.log(`[WARN] 강제 해제할 클라이언트를 찾을 수 없음: ${clientName}`);
        return false;
      }
    } catch (error) {
      console.error(`[ERROR] 클라이언트 강제 연결 해제 실패 (${clientName}):`, error);
      return false;
    }
  }

  // 모든 클라이언트 강제 연결 해제
  forceDisconnectAllClients() {
    try {
      const clientNames = Array.from(this.connectedClients.keys());
      console.log(`[INFO] 모든 클라이언트 강제 연결 해제 시작: ${clientNames.length}개`);
      
      let successCount = 0;
      clientNames.forEach(clientName => {
        if (this.forceDisconnectClient(clientName)) {
          successCount++;
        }
      });
      
      console.log(`[INFO] 강제 연결 해제 완료: ${successCount}/${clientNames.length}개 성공`);
      return successCount;
    } catch (error) {
      console.error('[ERROR] 모든 클라이언트 강제 연결 해제 실패:', error);
      return 0;
    }
  }

  // 특정 IP의 클라이언트 강제 연결 해제
  forceDisconnectByIP(ipAddress) {
    try {
      const targetClients = [];
      
      this.connectedClients.forEach((socket, clientName) => {
        const clientIP = this.normalizeIP(socket.handshake.address);
        if (clientIP === ipAddress) {
          targetClients.push(clientName);
        }
      });
      
      console.log(`[INFO] IP ${ipAddress}의 클라이언트 강제 연결 해제: ${targetClients.length}개`);
      
      let successCount = 0;
      targetClients.forEach(clientName => {
        if (this.forceDisconnectClient(clientName)) {
          successCount++;
        }
      });
      
      return successCount;
    } catch (error) {
      console.error(`[ERROR] IP ${ipAddress} 클라이언트 강제 연결 해제 실패:`, error);
      return 0;
    }
  }
}

// 싱글톤 인스턴스 생성 및 export
const socketService = new SocketService();
module.exports = socketService; 