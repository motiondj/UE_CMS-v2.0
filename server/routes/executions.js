const express = require('express');
const router = express.Router();
const ExecutionController = require('../controllers/executionController');
const asyncHandler = require('../middleware/asyncHandler');

// 실행 이력 조회
router.get('/', asyncHandler(ExecutionController.getAll));

// 실행 통계 조회
router.get('/statistics', asyncHandler(ExecutionController.getStatistics));

module.exports = router; 