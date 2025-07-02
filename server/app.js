const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');

// 설정 및 유틸리티
const config = require('./config/server');
const database = require('./config/database');
const logger = require('./utils/logger');

// 미들웨어
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// 서비스
const socketService = require('./services/socketService');

// 라우트
const routes = require('./routes');

// 데이터베이스 마이그레이션
const { runMigrations } = require('./db/migrations');

// Express 앱 생성
const app = express();

// 미들웨어 설정
app.use(cors(config.cors));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// API 라우트
app.use('/api', routes);

// favicon 라우트
app.get('/favicon.ico', (req, res) => {
  res.status(204).end(); // No content
});

// 기본 라우트 - 웹 UI 서빙
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 핸들러
app.use(notFoundHandler);

// 에러 핸들러
app.use(errorHandler);

// 서버 생성
const server = http.createServer(app);

// 서버 시작
async function startServer() {
  try {
    // 데이터베이스 초기화
    await database.initialize();
    
    // 마이그레이션 실행
    await runMigrations();
    
    // Socket.IO 초기화
    socketService.initialize(server);
    
    // 서버 시작
    server.listen(config.server.port, () => {
      logger.info(`🚀 UE CMS Server 시작됨`);
      logger.info(`📱 웹 인터페이스: http://localhost:${config.server.port}`);
      logger.info(`🔌 Socket.IO 활성화됨`);
    });
    
  } catch (error) {
    logger.error('서버 시작 실패:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('서버 종료 시작...');
  
  try {
    // 서버 종료
    server.close();
    
    // 데이터베이스 연결 종료
    await database.close();
    
    logger.info('서버 정상 종료됨');
    process.exit(0);
  } catch (error) {
    logger.error('서버 종료 중 오류:', error);
    process.exit(1);
  }
});

// 처리되지 않은 에러 핸들링
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// 서버 시작
startServer(); 