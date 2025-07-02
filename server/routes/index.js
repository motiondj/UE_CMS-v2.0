const express = require('express');
const router = express.Router();

// 라우트 모듈들
const clientRoutes = require('./clients');
const groupRoutes = require('./groups');
const presetRoutes = require('./presets');
const executionRoutes = require('./executions');

// 헬스 체크
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    server: 'UE CMS Server v2.0'
  });
});

// 라우트 등록
router.use('/clients', clientRoutes);
router.use('/groups', groupRoutes);
router.use('/presets', presetRoutes);
router.use('/executions', executionRoutes);

// 프로세스 상태 조회
router.get('/process-status', (req, res) => {
  try {
    const processStatus = global.processStatus || new Map();
    const statusData = {};
    
    for (const [clientName, status] of processStatus) {
      statusData[clientName] = status;
    }
    
    res.json({
      success: true,
      data: statusData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 특정 클라이언트의 프로세스 상태 조회
router.get('/process-status/:clientName', (req, res) => {
  try {
    const { clientName } = req.params;
    const processStatus = global.processStatus || new Map();
    
    if (processStatus.has(clientName)) {
      res.json({
        success: true,
        data: processStatus.get(clientName),
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(404).json({
        success: false,
        error: '클라이언트의 프로세스 상태를 찾을 수 없습니다.'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router; 