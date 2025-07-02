const express = require('express');
const router = express.Router();
const ClientController = require('../controllers/clientController');
const asyncHandler = require('../middleware/asyncHandler');

// 클라이언트 목록 조회
router.get('/', asyncHandler(ClientController.getAll));

// 클라이언트 생성
router.post('/', asyncHandler(ClientController.create));

// 클라이언트 수정
router.put('/:id', asyncHandler(ClientController.update));

// 클라이언트 삭제
router.delete('/:id', asyncHandler(ClientController.delete));

// MAC 주소 업데이트 (ID로)
router.put('/:id/mac-address', asyncHandler(ClientController.updateMacAddress));

// 하트비트
router.post('/heartbeat', asyncHandler(ClientController.heartbeat));

module.exports = router; 