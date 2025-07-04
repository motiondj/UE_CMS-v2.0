const PresetModel = require('../models/Preset');
const ClientModel = require('../models/Client');
const socketService = require('./socketService');
const logger = require('../utils/logger');
const db = require('../config/database');

class ExecutionService {
  // 프리셋 실행
  static async executePreset(presetId) {
    logger.info(`프리셋 실행 시작: ID ${presetId}`);
    console.log(`[DEBUG] executePreset 호출됨: ID ${presetId}`);
    
    // 프리셋 정보 조회
    const preset = await PresetModel.findById(presetId);
    if (!preset) {
      throw new Error('프리셋을 찾을 수 없습니다.');
    }
    
    // 대상 클라이언트 조회
    const clients = await PresetModel.getTargetClients(presetId);
    const onlineClients = clients.filter(c => c.status !== 'offline');
    
    if (onlineClients.length === 0) {
      throw new Error('실행 가능한 온라인 클라이언트가 없습니다.');
    }
    
    // 실행 결과 수집
    const executionResults = [];
    const warnings = [];
    
    // 각 클라이언트에 명령 전송
    for (const client of clients) {
      // 클라이언트 이름 정규화
      const normalizedClientName = client.name ? client.name.toUpperCase() : client.name;
      console.log(`[DEBUG] 클라이언트 처리 시작: ${normalizedClientName} (ID: ${client.id}, IP: ${client.ip_address}, 상태: ${client.status})`);
      
      // 명령어 찾기 (ID, 원본 이름, 정규화된 이름 순서로)
      const command = preset.client_commands[client.id] || preset.client_commands[client.name] || preset.client_commands[normalizedClientName];
      
      if (!command) {
        console.log(`[DEBUG] 클라이언트 ${normalizedClientName} (IP: ${client.ip_address})에 대한 명령어가 설정되지 않음`);
        warnings.push(`클라이언트 ${normalizedClientName}에 대한 명령어가 설정되지 않았습니다.`);
        continue;
      }
      
      console.log(`[DEBUG] 클라이언트 ${normalizedClientName} (IP: ${client.ip_address})에 명령 전송 시도: ${command.substring(0, 50)}...`);
      console.log(`[DEBUG] 프리셋 명령어 맵: ${JSON.stringify(preset.client_commands)}`);
      
      // IP 주소로 연결된 클라이언트 찾기 (더 안정적)
      const connectedClientName = socketService.findClientByIP(client.ip_address);
      const targetClientName = connectedClientName || client.name; // 원본 이름 사용
      
      console.log(`[DEBUG] IP ${client.ip_address}로 연결된 클라이언트: ${connectedClientName || '없음'}`);
      console.log(`[DEBUG] 최종 대상 클라이언트 이름: ${targetClientName}`);
      
      // 클라이언트 이름을 대문자로 정규화하여 전송 (서버 내부에서 대문자로 관리)
      const sendClientName = targetClientName.toUpperCase();
      
      const sent = socketService.emitToClient(sendClientName, 'execute_command', {
        clientName: sendClientName,
        command: command,
        presetId: preset.id
      });
      
      console.log(`[DEBUG] 명령 전송 결과: ${client.name} - ${sent ? '성공' : '실패'}`);
      
      if (sent) {
        // 상태 업데이트
        await ClientModel.updateStatus(client.id, 'running');
        
        // current_preset_id 업데이트
        await db.run(
          'UPDATE clients SET current_preset_id = ? WHERE id = ?',
          [preset.id, client.id]
        );
        
        // 실행 히스토리 기록
        await PresetModel.addExecutionHistory(preset.id, client.id, 'executing');
        
        executionResults.push({
          clientId: client.id,
          clientName: normalizedClientName,
          status: 'running'
        });
      } else {
        warnings.push(`클라이언트 ${normalizedClientName}가 연결되지 않았습니다.`);
        await PresetModel.addExecutionHistory(preset.id, client.id, 'failed_offline');
      }
    }
    
    // 프리셋의 마지막 실행 시간 업데이트
    await PresetModel.updateLastExecuted(preset.id);
    
    // 프리셋 실행 상태 업데이트 (실행 중인 클라이언트가 있으면 running으로 설정)
    if (executionResults.length > 0) {
      // 프리셋 상태를 running으로 설정
      await db.run(
        'UPDATE presets SET is_running = 1 WHERE id = ?',
        [preset.id]
      );
      
      console.log(`[DEBUG] 프리셋 ${preset.id} 상태를 running으로 업데이트`);
      
      // 웹 UI에 프리셋 상태 변경 이벤트 전송
      const statusEvent = {
        preset_id: preset.id,
        status: 'running',
        running_clients: executionResults.map(r => r.clientName)
      };
      
      console.log(`[DEBUG] 프리셋 상태 변경 이벤트 전송:`, statusEvent);
      socketService.emit('preset_status_changed', statusEvent);
    }
    
    // Socket.IO 이벤트 전송
    socketService.emit('preset_executed', {
      presetId: preset.id,
      presetName: preset.name,
      clients: executionResults,
      warnings: warnings
    });
    
    return {
      message: '프리셋이 실행되었습니다.',
      preset: preset,
      clients: executionResults,
      summary: {
        total: clients.length,
        online: onlineClients.length,
        offline: clients.length - onlineClients.length,
        executed: executionResults.length
      },
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  // 프리셋 정지
  static async stopPreset(presetId) {
    logger.info(`프리셋 정지 시작: ID ${presetId}`);
    
    // 프리셋 정보 조회
    const preset = await PresetModel.findById(presetId);
    if (!preset) {
      throw new Error('프리셋을 찾을 수 없습니다.');
    }
    
    // 대상 클라이언트 조회
    const clients = await PresetModel.getTargetClients(presetId);
    const stopResults = [];
    
    // 각 클라이언트에 정지 명령 전송
    for (const client of clients) {
      // 클라이언트 이름을 대문자로 정규화하여 전송 (서버 내부에서 대문자로 관리)
      const sendClientName = client.name.toUpperCase();
      
      const sent = socketService.emitToClient(sendClientName, 'stop_command', {
        clientName: sendClientName,
        presetId: preset.id
      });
      
      if (sent) {
        // 상태 업데이트
        await ClientModel.updateStatus(client.id, 'online');
        
        // current_preset_id 초기화
        await db.run(
          'UPDATE clients SET current_preset_id = NULL WHERE id = ?',
          [client.id]
        );
        
        stopResults.push({
          clientId: client.id,
          clientName: client.name,
          status: 'stopping'
        });
      }
    }
    
    // 프리셋 실행 상태 업데이트 (정지)
    await db.run(
      'UPDATE presets SET is_running = 0 WHERE id = ?',
      [preset.id]
    );
    
    // 웹 UI에 프리셋 상태 변경 이벤트 전송
    socketService.emit('preset_status_changed', {
      preset_id: preset.id,
      status: 'stopped',
      stopped_clients: stopResults.map(r => r.clientName)
    });
    
    // Socket.IO 이벤트 전송
    socketService.emit('preset_stopped', {
      presetId: preset.id,
      presetName: preset.name,
      clients: stopResults
    });
    
    return {
      message: '프리셋 정지 요청이 전송되었습니다.',
      preset: preset,
      clients: stopResults,
      summary: {
        total: clients.length,
        stopped: stopResults.length
      }
    };
  }

  // 프리셋 상태 조회
  static async getPresetStatus(presetId) {
    const preset = await PresetModel.findById(presetId);
    if (!preset) {
      throw new Error('프리셋을 찾을 수 없습니다.');
    }
    
    const clients = await PresetModel.getTargetClients(presetId);
    
    // 각 클라이언트의 상태 판정
    let runningCount = 0;
    let onlineCount = 0;
    let offlineCount = 0;
    
    for (const client of clients) {
      if (client.status === 'running' && client.current_preset_id == presetId) {
        runningCount++;
      } else if (client.status === 'online') {
        onlineCount++;
      } else {
        offlineCount++;
      }
    }
    
    // 프리셋 상태 판정
    let status = 'stopped';
    let statusColor = 'gray';
    
    if (runningCount > 0) {
      if (runningCount === clients.length) {
        status = 'running';
        statusColor = 'green';
      } else {
        status = 'partial';
        statusColor = 'yellow';
      }
    } else if (offlineCount === clients.length) {
      status = 'offline';
      statusColor = 'red';
    } else if (onlineCount > 0) {
      status = 'ready';
      statusColor = 'blue';
    }
    
    return {
      presetId: presetId,
      presetName: preset.name,
      status: status,
      statusColor: statusColor,
      summary: {
        total: clients.length,
        running: runningCount,
        online: onlineCount,
        offline: offlineCount
      },
      clients: clients.map(client => ({
        id: client.id,
        name: client.name,
        status: client.status,
        current_preset_id: client.current_preset_id,
        isRunningThisPreset: client.status === 'running' && client.current_preset_id == presetId
      }))
    };
  }
}

module.exports = ExecutionService; 