const GroupModel = require('../models/Group');
const socketService = require('../services/socketService');
const logger = require('../utils/logger');

class GroupController {
  // 모든 그룹 조회
  static async getAll(req, res, next) {
    try {
      const groups = await GroupModel.findAll();
      res.json(groups);
    } catch (error) {
      logger.error('그룹 조회 실패:', error);
      next(error);
    }
  }

  // 그룹 생성
  static async create(req, res, next) {
    try {
      const { name, description, client_ids } = req.body;
      
      if (!name) {
        return res.status(400).json({ 
          error: '그룹 이름은 필수입니다.' 
        });
      }
      
      if (!client_ids || !Array.isArray(client_ids) || client_ids.length === 0) {
        return res.status(400).json({ 
          error: '최소 한 개의 클라이언트를 그룹에 포함해야 합니다.' 
        });
      }

      const group = await GroupModel.create({ name, description, client_ids });
      
      // Socket.IO 이벤트 전송
      socketService.emit('group_added', group);
      
      logger.info(`새 그룹 생성: ${name}`);
      res.status(201).json(group);
    } catch (error) {
      logger.error('그룹 생성 실패:', error);
      next(error);
    }
  }

  // 그룹 업데이트
  static async update(req, res, next) {
    try {
      const { id } = req.params;
      const { name, description, client_ids } = req.body;
      
      if (!name) {
        return res.status(400).json({ 
          error: '그룹 이름은 필수입니다.' 
        });
      }
      
      if (!client_ids || !Array.isArray(client_ids) || client_ids.length === 0) {
        return res.status(400).json({ 
          error: '최소 한 개의 클라이언트를 그룹에 포함해야 합니다.' 
        });
      }

      const group = await GroupModel.update(id, { name, description, client_ids });
      
      // Socket.IO 이벤트 전송
      socketService.emit('group_updated', group);
      
      logger.info(`그룹 업데이트: ${name} (ID: ${id})`);
      res.json(group);
    } catch (error) {
      logger.error('그룹 업데이트 실패:', error);
      next(error);
    }
  }

  // 그룹 삭제
  static async delete(req, res, next) {
    try {
      const { id } = req.params;
      
      const success = await GroupModel.delete(id);
      
      if (!success) {
        return res.status(404).json({ 
          error: '그룹을 찾을 수 없습니다.' 
        });
      }

      // Socket.IO 이벤트 전송
      socketService.emit('group_deleted', { id: parseInt(id) });
      
      logger.info(`그룹 삭제: ID ${id}`);
      res.json({ message: '그룹이 삭제되었습니다.' });
    } catch (error) {
      logger.error('그룹 삭제 실패:', error);
      next(error);
    }
  }
}

module.exports = GroupController; 