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

// 누락된 API 엔드포인트들 추가
router.get('/changes', (req, res) => {
  try {
    const { since } = req.query;
    // 변경사항 조회 로직 (임시로 빈 응답)
    res.json({
      changed: [],
      deleted: [],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/heartbeat', (req, res) => {
  try {
    const { clientName } = req.body;
    // 하트비트 처리 로직 (임시로 성공 응답)
    res.json({
      success: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
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

// 강제 연결 해제 API 엔드포인트 추가
router.post('/force-disconnect/:clientName', (req, res) => {
  try {
    const { clientName } = req.params;
    
    // SocketService 인스턴스 가져오기
    const socketService = require('../services/socketService');
    const socketServiceInstance = socketService.getInstance();
    
    if (!socketServiceInstance) {
      return res.status(500).json({
        success: false,
        error: 'SocketService가 초기화되지 않았습니다.'
      });
    }
    
    const result = socketServiceInstance.forceDisconnectClient(clientName);
    
    if (result) {
      res.json({
        success: true,
        message: `클라이언트 ${clientName} 강제 연결 해제 요청이 전송되었습니다.`,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(404).json({
        success: false,
        error: `클라이언트 ${clientName}를 찾을 수 없습니다.`
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 모든 클라이언트 강제 연결 해제
router.post('/force-disconnect-all', (req, res) => {
  try {
    const socketService = require('../services/socketService');
    const socketServiceInstance = socketService.getInstance();
    
    if (!socketServiceInstance) {
      return res.status(500).json({
        success: false,
        error: 'SocketService가 초기화되지 않았습니다.'
      });
    }
    
    const result = socketServiceInstance.forceDisconnectAllClients();
    
    res.json({
      success: true,
      message: `${result}개 클라이언트 강제 연결 해제 요청이 전송되었습니다.`,
      disconnectedCount: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 특정 IP의 클라이언트 강제 연결 해제
router.post('/force-disconnect-ip/:ipAddress', (req, res) => {
  try {
    const { ipAddress } = req.params;
    
    const socketService = require('../services/socketService');
    const socketServiceInstance = socketService.getInstance();
    
    if (!socketServiceInstance) {
      return res.status(500).json({
        success: false,
        error: 'SocketService가 초기화되지 않았습니다.'
      });
    }
    
    const result = socketServiceInstance.forceDisconnectByIP(ipAddress);
    
    res.json({
      success: true,
      message: `IP ${ipAddress}의 ${result}개 클라이언트 강제 연결 해제 요청이 전송되었습니다.`,
      disconnectedCount: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router; 