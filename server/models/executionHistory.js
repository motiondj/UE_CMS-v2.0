const db = require('../config/database');
const logger = require('../utils/logger');

class ExecutionHistoryModel {
  // 실행 히스토리 생성
  static async create(presetId, presetName, groupId, clientIds) {
    try {
      const executionId = `exec_${presetId}_${Date.now()}`;
      
      const execution = {
        id: executionId,
        preset_id: presetId,
        preset_name: presetName,
        group_id: groupId,
        started_at: new Date().toISOString(),
        status: 'running',
        total_clients: clientIds.length,
        target_clients: JSON.stringify(clientIds),
        successful_clients: JSON.stringify([]),
        failed_clients: JSON.stringify([]),
        error_messages: JSON.stringify({}),
        created_at: new Date().toISOString()
      };

      const result = await db.run(`
        INSERT INTO execution_history (
          id, preset_id, preset_name, group_id, started_at, status, 
          total_clients, target_clients, successful_clients, failed_clients, 
          error_messages, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        execution.id, execution.preset_id, execution.preset_name, execution.group_id,
        execution.started_at, execution.status, execution.total_clients,
        execution.target_clients, execution.successful_clients, execution.failed_clients,
        execution.error_messages, execution.created_at
      ]);

      if (result && result.lastID) {
        logger.info(`실행 히스토리 생성: ${executionId}`);
        return executionId;
      } else {
        throw new Error('실행 히스토리 생성 실패');
      }
    } catch (error) {
      logger.error('실행 히스토리 생성 실패:', error);
      throw error;
    }
  }

  // 클라이언트별 실행 결과 업데이트
  static async updateClientResult(executionId, clientId, success, errorMessage = null) {
    try {
      // 기존 실행 히스토리 조회
      const execution = await this.findById(executionId);
      if (!execution) {
        throw new Error('실행 히스토리를 찾을 수 없습니다');
      }

      let successfulClients = JSON.parse(execution.successful_clients || '[]');
      let failedClients = JSON.parse(execution.failed_clients || '[]');
      let errorMessages = JSON.parse(execution.error_messages || '{}');

      if (success) {
        if (!successfulClients.includes(clientId)) {
          successfulClients.push(clientId);
        }
        // 실패 목록에서 제거
        failedClients = failedClients.filter(id => id !== clientId);
      } else {
        if (!failedClients.includes(clientId)) {
          failedClients.push(clientId);
        }
        // 성공 목록에서 제거
        successfulClients = successfulClients.filter(id => id !== clientId);
        
        if (errorMessage) {
          errorMessages[clientId] = errorMessage;
        }
      }

      // 업데이트
      await db.run(`
        UPDATE execution_history 
        SET successful_clients = ?, failed_clients = ?, error_messages = ?
        WHERE id = ?
      `, [
        JSON.stringify(successfulClients),
        JSON.stringify(failedClients),
        JSON.stringify(errorMessages),
        executionId
      ]);

      logger.debug(`실행 결과 업데이트: ${executionId}, 클라이언트 ${clientId}, 성공: ${success}`);
    } catch (error) {
      logger.error('실행 결과 업데이트 실패:', error);
      throw error;
    }
  }

  // 실행 완료 처리
  static async complete(executionId, status = 'completed') {
    try {
      const execution = await this.findById(executionId);
      if (!execution) {
        throw new Error('실행 히스토리를 찾을 수 없습니다');
      }

      const completedAt = new Date().toISOString();
      const startedAt = new Date(execution.started_at);
      const durationSeconds = (new Date(completedAt) - startedAt) / 1000;

      await db.run(`
        UPDATE execution_history 
        SET completed_at = ?, status = ?, duration_seconds = ?
        WHERE id = ?
      `, [completedAt, status, durationSeconds, executionId]);

      logger.info(`실행 완료: ${executionId}, 상태: ${status}, 소요시간: ${durationSeconds}초`);
    } catch (error) {
      logger.error('실행 완료 처리 실패:', error);
      throw error;
    }
  }

  // 최근 실행 히스토리 조회
  static async getRecent(limit = 10) {
    try {
      const query = `
        SELECT * FROM execution_history 
        ORDER BY started_at DESC 
        LIMIT ?
      `;
      
      const executions = await db.all(query, [limit]);
      
      // JSON 필드 파싱
      return executions.map(execution => ({
        ...execution,
        target_clients: JSON.parse(execution.target_clients || '[]'),
        successful_clients: JSON.parse(execution.successful_clients || '[]'),
        failed_clients: JSON.parse(execution.failed_clients || '[]'),
        error_messages: JSON.parse(execution.error_messages || '{}')
      }));
    } catch (error) {
      logger.error('최근 실행 히스토리 조회 실패:', error);
      throw error;
    }
  }

  // 특정 프리셋의 실행 히스토리
  static async getByPresetId(presetId, limit = 10) {
    try {
      const query = `
        SELECT * FROM execution_history 
        WHERE preset_id = ?
        ORDER BY started_at DESC 
        LIMIT ?
      `;
      
      const executions = await db.all(query, [presetId, limit]);
      
      // JSON 필드 파싱
      return executions.map(execution => ({
        ...execution,
        target_clients: JSON.parse(execution.target_clients || '[]'),
        successful_clients: JSON.parse(execution.successful_clients || '[]'),
        failed_clients: JSON.parse(execution.failed_clients || '[]'),
        error_messages: JSON.parse(execution.error_messages || '{}')
      }));
    } catch (error) {
      logger.error('프리셋 실행 히스토리 조회 실패:', error);
      throw error;
    }
  }

  // ID로 실행 히스토리 조회
  static async findById(id) {
    try {
      const execution = await db.get('SELECT * FROM execution_history WHERE id = ?', [id]);
      
      if (execution) {
        return {
          ...execution,
          target_clients: JSON.parse(execution.target_clients || '[]'),
          successful_clients: JSON.parse(execution.successful_clients || '[]'),
          failed_clients: JSON.parse(execution.failed_clients || '[]'),
          error_messages: JSON.parse(execution.error_messages || '{}')
        };
      }
      
      return null;
    } catch (error) {
      logger.error('실행 히스토리 조회 실패:', error);
      throw error;
    }
  }

  // 실행 통계 조회
  static async getStats() {
    try {
      const stats = await db.get(`
        SELECT 
          COUNT(*) as total_executions,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_executions,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_executions,
          COUNT(CASE WHEN status = 'running' THEN 1 END) as running_executions,
          AVG(duration_seconds) as avg_duration
        FROM execution_history
      `);

      return {
        total_executions: stats.total_executions || 0,
        completed_executions: stats.completed_executions || 0,
        failed_executions: stats.failed_executions || 0,
        running_executions: stats.running_executions || 0,
        avg_duration: stats.avg_duration || 0
      };
    } catch (error) {
      logger.error('실행 통계 조회 실패:', error);
      throw error;
    }
  }
}

module.exports = ExecutionHistoryModel; 