const ExecutionModel = require('../models/Execution');
const logger = require('../utils/logger');

class ExecutionController {
  // 실행 이력 조회
  static async getAll(req, res, next) {
    try {
      const { limit = 50 } = req.query;
      const executions = await ExecutionModel.findAll(parseInt(limit));
      res.json(executions);
    } catch (error) {
      logger.error('실행 이력 조회 실패:', error);
      next(error);
    }
  }

  // 실행 통계 조회
  static async getStatistics(req, res, next) {
    try {
      const stats = await ExecutionModel.getStatistics();
      res.json(stats);
    } catch (error) {
      logger.error('실행 통계 조회 실패:', error);
      next(error);
    }
  }
}

module.exports = ExecutionController; 