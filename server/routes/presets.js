const express = require('express');
const router = express.Router();
const PresetController = require('../controllers/presetController');
const asyncHandler = require('../middleware/asyncHandler');

// 프리셋 목록 조회
router.get('/', asyncHandler(PresetController.getAll));

// 프리셋 생성
router.post('/', asyncHandler(PresetController.create));

// 프리셋 수정
router.put('/:id', asyncHandler(PresetController.update));

// 프리셋 삭제
router.delete('/:id', asyncHandler(PresetController.delete));

// 프리셋 실행
router.post('/:id/execute', asyncHandler(PresetController.execute));

// 프리셋 정지
router.post('/:id/stop', asyncHandler(PresetController.stop));

// 프리셋 상태 조회
router.get('/:id/status', asyncHandler(PresetController.getStatus));

module.exports = router; 