const PresetModel = require('../models/Preset');
const ExecutionService = require('../services/executionService');
const socketService = require('../services/socketService');
const logger = require('../utils/logger');

class PresetController {
  // 모든 프리셋 조회
  static async getAll(req, res, next) {
    try {
      const presets = await PresetModel.findAll();
      res.json(presets);
    } catch (error) {
      logger.error('프리셋 조회 실패:', error);
      next(error);
    }
  }

  // 프리셋 생성
  static async create(req, res, next) {
    try {
      const { name, description, target_group_id, client_commands } = req.body;
      
      // 유효성 검사
      if (!name || !target_group_id || !client_commands || Object.keys(client_commands).length === 0) {
        return res.status(400).json({ 
          error: '프리셋 이름, 대상 그룹, 명령어는 필수입니다.' 
        });
      }

      const preset = await PresetModel.create({
        name, description, target_group_id, client_commands
      });
      
      // Socket.IO 이벤트 전송
      socketService.emit('preset_added', preset);
      
      logger.info(`새 프리셋 생성: ${name}`);
      res.status(201).json(preset);
    } catch (error) {
      logger.error('프리셋 생성 실패:', error);
      next(error);
    }
  }

  // 프리셋 업데이트
  static async update(req, res, next) {
    try {
      const { id } = req.params;
      const { name, description, target_group_id, client_commands } = req.body;
      
      if (!name || !target_group_id || !client_commands || Object.keys(client_commands).length === 0) {
        return res.status(400).json({ 
          error: '프리셋 이름, 대상 그룹, 명령어는 필수입니다.' 
        });
      }

      const preset = await PresetModel.update(id, {
        name, description, target_group_id, client_commands
      });
      
      // Socket.IO 이벤트 전송
      socketService.emit('preset_updated', preset);
      
      logger.info(`프리셋 업데이트: ${name} (ID: ${id})`);
      res.json(preset);
    } catch (error) {
      if (error.message === '프리셋을 찾을 수 없습니다.') {
        return res.status(404).json({ error: error.message });
      }
      logger.error('프리셋 업데이트 실패:', error);
      next(error);
    }
  }

  // 프리셋 삭제
  static async delete(req, res, next) {
    try {
      const { id } = req.params;
      
      const success = await PresetModel.delete(id);
      
      if (!success) {
        return res.status(404).json({ 
          error: '프리셋을 찾을 수 없습니다.' 
        });
      }

      // Socket.IO 이벤트 전송
      socketService.emit('preset_deleted', { id: parseInt(id) });
      
      logger.info(`프리셋 삭제: ID ${id}`);
      res.json({ message: '프리셋이 삭제되었습니다.' });
    } catch (error) {
      logger.error('프리셋 삭제 실패:', error);
      next(error);
    }
  }

  // 프리셋 실행
  static async execute(req, res, next) {
    try {
      const { id } = req.params;
      
      console.log(`[DEBUG] 프리셋 실행 API 호출됨: ID ${id}`);
      logger.info(`프리셋 실행 API 호출됨: ID ${id}`);
      
      const result = await ExecutionService.executePreset(id);
      
      console.log(`[DEBUG] 프리셋 실행 완료: ID ${id}, 결과:`, result);
      logger.info(`프리셋 실행: ID ${id}, 성공 ${result.summary.successful}개, 실패 ${result.summary.failed}개`);
      res.json(result);
    } catch (error) {
      console.log(`[DEBUG] 프리셋 실행 오류: ID ${id}, 오류:`, error.message);
      if (error.message === '프리셋을 찾을 수 없습니다.') {
        return res.status(404).json({ error: error.message });
      }
      logger.error('프리셋 실행 실패:', error);
      next(error);
    }
  }

  // 프리셋 정지
  static async stop(req, res, next) {
    try {
      const { id } = req.params;
      
      const result = await ExecutionService.stopPreset(id);
      
      logger.info(`프리셋 정지: ID ${id}, 정지 ${result.summary.stopped}개`);
      res.json(result);
    } catch (error) {
      if (error.message === '프리셋을 찾을 수 없습니다.') {
        return res.status(404).json({ error: error.message });
      }
      logger.error('프리셋 정지 실패:', error);
      next(error);
    }
  }

  // 프리셋 상태 조회
  static async getStatus(req, res, next) {
    try {
      const { id } = req.params;
      
      const status = await ExecutionService.getPresetStatus(id);
      
      res.json(status);
    } catch (error) {
      if (error.message === '프리셋을 찾을 수 없습니다.') {
        return res.status(404).json({ error: error.message });
      }
      logger.error('프리셋 상태 조회 실패:', error);
      next(error);
    }
  }
}

module.exports = PresetController; 