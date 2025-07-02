const ping = require('ping');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

class PowerManager {
  constructor(db, io) {
    this.db = db;
    this.io = io;
    this.monitoringInterval = null;
  }

  // Wake-on-LAN 패킷 전송
  async wakeOnLan(macAddress) {
    try {
      // MAC 주소를 바이트로 변환
      const macBytes = Buffer.from(macAddress.replace(/:/g, ''), 'hex');
      
      // Magic Packet 생성 (6바이트 FF + MAC 주소 16번 반복)
      const magicPacket = Buffer.concat([
        Buffer.alloc(6, 0xFF),
        Buffer.concat(Array(16).fill(macBytes))
      ]);
      
      // UDP 소켓으로 브로드캐스트 전송
      const dgram = require('dgram');
      const socket = dgram.createSocket('udp4');
      
      return new Promise((resolve) => {
        socket.send(magicPacket, 9, '255.255.255.255', (err) => {
          socket.close();
          if (err) {
            console.error('Wake-on-LAN 실패:', err);
            resolve(false);
          } else {
            console.log(`🔌 Wake-on-LAN 패킷 전송: ${macAddress}`);
            resolve(true);
          }
        });
      });
    } catch (error) {
      console.error('Wake-on-LAN 오류:', error);
      return false;
    }
  }

  // 클라이언트 전원 상태 확인
  async checkClientPower(clientId) {
    try {
      const client = await this.getClientById(clientId);
      if (!client) {
        return { status: 'error', error: 'Client not found' };
      }

      // Ping으로 전원 상태 확인
      const isOnline = await this.pingClient(client.ip_address);
      
      const powerState = isOnline ? 'online' : 'offline';
      
      // 전원 상태 업데이트
      await this.updatePowerState(clientId, powerState);
      
      return {
        status: powerState,
        lastCheck: new Date(),
        uptime: isOnline ? await this.getClientUptime(clientId) : null
      };
    } catch (error) {
      console.error('전원 상태 확인 오류:', error);
      return {
        status: 'error',
        lastCheck: new Date(),
        error: error.message
      };
    }
  }

  // Ping으로 클라이언트 상태 확인
  async pingClient(ipAddress) {
    try {
      const result = await ping.promise.probe(ipAddress, {
        timeout: 5,
        min_reply: 1
      });
      return result.alive;
    } catch (error) {
      console.error('Ping 실패:', error);
      return false;
    }
  }

  // 클라이언트 가동시간 조회
  async getClientUptime(clientId) {
    try {
      const client = await this.getClientById(clientId);
      if (!client) return null;

      // Windows의 경우 PowerShell 명령어 사용 (한글 Windows 호환)
      const { stdout } = await execAsync('powershell -Command "(get-date) - (gcim Win32_OperatingSystem).LastBootUpTime"');
      
      if (stdout && stdout.trim()) {
        // PowerShell 출력 파싱 (예: "00:00:00.0000000" 형식)
        const uptimeMatch = stdout.trim().match(/(\d+):(\d+):(\d+)/);
        if (uptimeMatch) {
          const hours = parseInt(uptimeMatch[1]);
          const minutes = parseInt(uptimeMatch[2]);
          const seconds = parseInt(uptimeMatch[3]);
          const uptimeSeconds = hours * 3600 + minutes * 60 + seconds;
          return uptimeSeconds;
        }
      }
      
      return null;
    } catch (error) {
      console.error('가동시간 조회 실패:', error);
      return null;
    }
  }

  // 전원 액션 실행
  async executePowerAction(clientId, action) {
    try {
      const client = await this.getClientById(clientId);
      if (!client) {
        throw new Error('Client not found');
      }

      let success = false;
      let errorMessage = null;

      switch (action) {
        case 'wake':
          const powerInfo = await this.getPowerInfo(clientId);
          if (powerInfo && powerInfo.mac_address) {
            success = await this.wakeOnLan(powerInfo.mac_address);
          } else {
            errorMessage = 'MAC 주소가 설정되지 않았습니다.';
          }
          break;
          
        case 'shutdown':
          success = await this.shutdownClient(clientId);
          break;
          
        case 'restart':
          success = await this.restartClient(clientId);
          break;
          
        default:
          throw new Error('Invalid action');
      }

      // 액션 히스토리 기록
      await this.recordPowerAction(clientId, action, success ? 'success' : 'failed', errorMessage);

      return { success, error: errorMessage };
    } catch (error) {
      console.error('전원 액션 실행 실패:', error);
      await this.recordPowerAction(clientId, action, 'failed', error.message);
      return { success: false, error: error.message };
    }
  }

  // 클라이언트 종료
  async shutdownClient(clientId) {
    try {
      const client = await this.getClientById(clientId);
      if (!client) return false;

      // 클라이언트에 종료 명령 전송
      this.io.to(client.name).emit('power_action', {
        action: 'shutdown',
        clientId: clientId
      });

      return true;
    } catch (error) {
      console.error('클라이언트 종료 실패:', error);
      return false;
    }
  }

  // 클라이언트 재부팅
  async restartClient(clientId) {
    try {
      const client = await this.getClientById(clientId);
      if (!client) return false;

      // 클라이언트에 재부팅 명령 전송
      this.io.to(client.name).emit('power_action', {
        action: 'restart',
        clientId: clientId
      });

      return true;
    } catch (error) {
      console.error('클라이언트 재부팅 실패:', error);
      return false;
    }
  }

  // 일괄 전원 제어
  async executeBulkPowerAction(action, clientIds) {
    try {
      const bulkAction = await this.createBulkPowerAction(action, clientIds.length);
      
      // 각 클라이언트에 액션 실행
      const results = await Promise.allSettled(
        clientIds.map(clientId => this.executePowerAction(clientId, action))
      );
      
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.length - successful;
      
      // 일괄 액션 결과 업데이트
      await this.updateBulkPowerAction(bulkAction.id, successful, failed);
      
      return {
        success: true,
        bulk_action_id: bulkAction.id,
        results: { successful, failed, total: results.length }
      };
    } catch (error) {
      console.error('일괄 전원 제어 실패:', error);
      return { success: false, error: error.message };
    }
  }

  // 데이터베이스 헬퍼 메서드들
  async getClientById(clientId) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM clients WHERE id = ?', [clientId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async getPowerInfo(clientId) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM client_power_info WHERE client_id = ?', [clientId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async updatePowerState(clientId, powerState) {
    return new Promise((resolve, reject) => {
      this.db.run(`
        INSERT OR REPLACE INTO client_power_info 
        (client_id, power_state, last_power_check, updated_at) 
        VALUES (?, ?, ?, ?)
      `, [clientId, powerState, new Date().toISOString(), new Date().toISOString()], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async recordPowerAction(clientId, actionType, status, errorMessage = null) {
    return new Promise((resolve, reject) => {
      this.db.run(`
        INSERT INTO power_action_history 
        (client_id, action_type, action_status, error_message) 
        VALUES (?, ?, ?, ?)
      `, [clientId, actionType, status, errorMessage], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async createBulkPowerAction(actionType, targetCount) {
    return new Promise((resolve, reject) => {
      this.db.run(`
        INSERT INTO bulk_power_actions 
        (action_type, target_client_count) 
        VALUES (?, ?)
      `, [actionType, targetCount], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, action_type: actionType, target_client_count: targetCount });
      });
    });
  }

  async updateBulkPowerAction(bulkActionId, successful, failed) {
    return new Promise((resolve, reject) => {
      this.db.run(`
        UPDATE bulk_power_actions 
        SET successful_count = ?, failed_count = ?, status = 'completed', completed_at = ? 
        WHERE id = ?
      `, [successful, failed, new Date().toISOString(), bulkActionId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  // 전원 상태 모니터링 시작
  startMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(async () => {
      try {
        const clients = await this.getAllClients();
        
        for (const client of clients) {
          const powerState = await this.checkClientPower(client.id);
          
          // 웹 UI에 실시간 업데이트 전송
          this.io.emit('power_state_updated', {
            clientId: client.id,
            powerState
          });
        }
      } catch (error) {
        console.error('전원 모니터링 오류:', error);
      }
    }, 30000); // 30초마다 체크

    console.log('🔌 전원 상태 모니터링 시작');
  }

  // 전원 상태 모니터링 중지
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('🔌 전원 상태 모니터링 중지');
    }
  }

  async getAllClients() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM clients', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = PowerManager; 