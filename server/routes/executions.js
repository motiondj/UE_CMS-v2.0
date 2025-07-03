const express = require('express');
const router = express.Router();
const ExecutionController = require('../controllers/executionController');
const asyncHandler = require('../middleware/asyncHandler');
const ExecutionHistoryModel = require('../models/executionHistory');

// 실행 이력 조회
router.get('/', asyncHandler(ExecutionController.getAll));

// 실행 통계 조회
router.get('/statistics', asyncHandler(ExecutionController.getStatistics));

// 실행 히스토리 목록 조회
router.get('/', asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;
  const executions = await ExecutionHistoryModel.getRecent(parseInt(limit));
  res.json(executions);
}));

// 실행 히스토리 통계 조회
router.get('/stats', asyncHandler(async (req, res) => {
  const stats = await ExecutionHistoryModel.getStats();
  res.json(stats);
}));

// 특정 프리셋의 실행 히스토리 조회
router.get('/preset/:presetId', asyncHandler(async (req, res) => {
  const { presetId } = req.params;
  const { limit = 10 } = req.query;
  const executions = await ExecutionHistoryModel.getByPresetId(presetId, parseInt(limit));
  res.json(executions);
}));

// 특정 실행 히스토리 조회
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const execution = await ExecutionHistoryModel.findById(id);
  
  if (!execution) {
    return res.status(404).json({ error: '실행 히스토리를 찾을 수 없습니다.' });
  }
  
  res.json(execution);
}));

module.exports = router; 