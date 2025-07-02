const express = require('express');
const router = express.Router();
const GroupController = require('../controllers/groupController');
const asyncHandler = require('../middleware/asyncHandler');

// 그룹 목록 조회
router.get('/', asyncHandler(GroupController.getAll));

// 그룹 생성
router.post('/', asyncHandler(GroupController.create));

// 그룹 수정
router.put('/:id', asyncHandler(GroupController.update));

// 그룹 삭제
router.delete('/:id', asyncHandler(GroupController.delete));

module.exports = router; 