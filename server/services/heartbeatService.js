const ClientModel = require('../models/Client');
const socketService = require('./socketService');
const logger = require('../utils/logger');

class HeartbeatService {
  constructor() {
    this.clientHeartbeats = new Map();
    this.running = false;
    this.monitorInterval = null;
  }

  async start() {
    if (this.running) {
      logger.warn('하트비트 서비스가 이미 실행 중입니다.');
      return;
    }

    this.running = true;
    logger.info('🔄 하트비트 서비스 시작됨');
    
    // 30초마다 하트비트 모니터링
    this.monitorInterval = setInterval(() => {
      this.monitorHeartbeats();
    }, 30000);
  }

  async stop() {
    if (!this.running) {
      return;
    }

    this.running = false;
    
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    
    logger.info('⏹️ 하트비트 서비스 중지됨');
  }

  async receiveHeartbeat(clientName, ipAddress) {
    try {
      // IP 주소를 우선으로 클라이언트 찾기 (더 안정적)
      let client = await ClientModel.findByIP(ipAddress);
      
      // IP로 찾지 못한 경우에만 이름으로 찾기
      if (!client) {
        client = await ClientModel.findByName(clientName);
      }
      
      if (!client) {
        logger.warn(`하트비트 수신: 클라이언트를 찾을 수 없음 - ${clientName} (IP: ${ipAddress})`);
        return;
      }
      
      const previousStatus = client.status;
      this.clientHeartbeats.set(client.id, new Date());
      
      // DB에 last_seen 업데이트
      await ClientModel.updateStatus(client.id, 'online');
      
      // 상태가 변경된 경우에만 이벤트 전송
      if (previousStatus === 'offline') {
        socketService.emit('client_status_changed', {
          client_id: client.id,
          status: 'online',
          reason: 'heartbeat_updated'
        });
        logger.info(`💓 클라이언트 ${clientName} (ID: ${client.id}) 온라인 상태 유지 알림 전송`);
      }
      
      logger.debug(`💓 클라이언트 ${clientName} (ID: ${client.id}) 하트비트 수신`);
    } catch (error) {
      logger.error(`하트비트 처리 실패 (클라이언트 ${clientName}):`, error);
    }
  }

  async monitorHeartbeats() {
    if (!this.running) return;

    try {
      const currentTime = new Date();
      const timeoutThreshold = new Date(currentTime.getTime() - 30000); // 30초 타임아웃
      
      // 모든 온라인 클라이언트 확인
      const onlineClients = await ClientModel.findOnlineClients();
      
      for (const client of onlineClients) {
        const clientId = client.id;
        const lastHeartbeat = this.clientHeartbeats.get(clientId) || client.last_seen;
        
        // 타임아웃 체크
        if (!lastHeartbeat || new Date(lastHeartbeat) < timeoutThreshold) {
          // 오프라인으로 변경
          await ClientModel.updateStatus(clientId, 'offline');
          
          // Socket으로 알림
          socketService.emit('client_status_changed', {
            client_id: clientId,
            status: 'offline',
            reason: 'heartbeat_timeout'
          });
          
          // 실행 중이던 프리셋 정리
          if (client.current_preset_id) {
            await this.cleanupPresetExecution(clientId, client.current_preset_id);
          }
          
          logger.info(`❌ 클라이언트 ${clientId} 하트비트 타임아웃으로 오프라인 처리`);
        }
      }
    } catch (error) {
      logger.error('하트비트 모니터링 오류:', error);
    }
  }

  async cleanupPresetExecution(clientId, presetId) {
    try {
      // 클라이언트의 프리셋 실행 정보 제거
      await ClientModel.updateStatus(clientId, 'offline');
      
      // 프리셋의 실행 중 클라이언트 목록에서 제거
      const PresetModel = require('../models/Preset');
      const preset = await PresetModel.findById(presetId);
      
      if (preset && preset.running_client_ids) {
        const updatedRunning = preset.running_client_ids.filter(cid => cid !== clientId);
        
        await PresetModel.update(presetId, {
          ...preset,
          running_client_ids: updatedRunning,
          is_running: updatedRunning.length > 0
        });
        
        // Socket으로 프리셋 상태 변경 알림
        socketService.emit('preset_status_changed', {
          preset_id: presetId,
          status: updatedRunning.length === 0 ? 'stopped' : 'partial',
          running_clients: updatedRunning
        });
        
        logger.info(`🧹 클라이언트 ${clientId}의 프리셋 ${presetId} 실행 정리 완료`);
      }
    } catch (error) {
      logger.error(`프리셋 실행 정리 실패 (클라이언트 ${clientId}, 프리셋 ${presetId}):`, error);
    }
  }

  // 하트비트 통계 조회
  getHeartbeatStats() {
    const stats = {
      totalClients: this.clientHeartbeats.size,
      activeClients: 0,
      inactiveClients: 0,
      lastUpdate: new Date().toISOString()
    };

    const currentTime = new Date();
    const timeoutThreshold = new Date(currentTime.getTime() - 30000);

    for (const [clientId, lastHeartbeat] of this.clientHeartbeats) {
      if (lastHeartbeat > timeoutThreshold) {
        stats.activeClients++;
      } else {
        stats.inactiveClients++;
      }
    }

    return stats;
  }
}

// 싱글톤 인스턴스 생성
const heartbeatService = new HeartbeatService();

module.exports = heartbeatService; 