const PresetModel = require('../models/Preset');
const ClientModel = require('../models/Client');
const socketService = require('./socketService');
const logger = require('../utils/logger');

class ExecutionService {
  // 프리셋 실행
  static async executePreset(presetId) {
    logger.info(`프리셋 실행 시작: ID ${presetId}`);
    
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
      const command = preset.client_commands[client.id] || preset.client_commands[client.name];
      
      if (!command) {
        warnings.push(`클라이언트 ${client.name}에 대한 명령어가 설정되지 않았습니다.`);
        continue;
      }
      
      const sent = socketService.emitToClient(client.name, 'execute_command', {
        clientName: client.name,
        command: command,
        presetId: preset.id
      });
      
      if (sent) {
        // 상태 업데이트
        await ClientModel.update(client.id, { 
          status: 'running',
          current_preset_id: preset.id
        });
        
        // 실행 히스토리 기록
        await PresetModel.addExecutionHistory(preset.id, client.id, 'executing');
        
        executionResults.push({
          clientId: client.id,
          clientName: client.name,
          status: 'running'
        });
      } else {
        warnings.push(`클라이언트 ${client.name}가 연결되지 않았습니다.`);
        await PresetModel.addExecutionHistory(preset.id, client.id, 'failed_offline');
      }
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
      const sent = socketService.emitToClient(client.name, 'stop_command', {
        clientName: client.name,
        presetId: preset.id
      });
      
      if (sent) {
        // 상태 업데이트
        await ClientModel.update(client.id, { 
          status: 'online',
          current_preset_id: null
        });
        
        stopResults.push({
          clientId: client.id,
          clientName: client.name,
          status: 'stopping'
        });
      }
    }
    
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