module.exports = {
  // 서버 설정
  server: {
    port: process.env.PORT || 8000,
    host: process.env.HOST || 'localhost'
  },
  
  // CORS 설정
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  },
  
  // Socket.IO 설정 - 문서 정확히 따름
  socket: {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    },
    pingInterval: 60000,  // 1분 (기존: 30초) - 더 관대하게
    pingTimeout: 300000,  // 5분 (기존: 2분) - 더 관대하게
    transports: ['websocket', 'polling'],
    
    // 새로 추가
    allowEIO3: true,      // 호환성 향상
    maxHttpBufferSize: 1e6, // 1MB
    connectTimeout: 60000,   // 1분 연결 타임아웃
    
    // 연결 유지 설정 추가
    allowUpgrades: true,
    upgradeTimeout: 10000,
    maxHttpBufferSize: 1e6,
    
    // 클라이언트 연결 해제 방지
    allowRequest: (req, callback) => {
      callback(null, true); // 모든 연결 허용
    }
  },
  
  // 데이터베이스 설정
  database: {
    filename: process.env.DB_FILE || './ue_cms.db',
    busyTimeout: 5000,
    verbose: process.env.NODE_ENV === 'development'
  },
  
  // 모니터링 설정 - 문서 정확히 따름
  monitoring: {
    healthCheckInterval: 30000,    // 30초 (기존: 15초)
    offlineTimeout: 300000,        // 5분 (기존: 2분) - 너무 짧았음
    connectionCheckInterval: 30000, // 30초 (기존: 15초)
    processCheckInterval: 20000,    // 20초 (기존: 10초)
    
    // 새로 추가할 설정들
    maxMissedHeartbeats: 3,        // 3번 놓치면 오프라인
    heartbeatGracePeriod: 60000,   // 1분 여유시간
    reconnectionGracePeriod: 120000 // 2분 재연결 대기
  },
  
  // 로깅 설정
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filename: 'logs/app.log',
    errorFilename: 'logs/error.log',
    maxSize: '10m',
    maxFiles: '7d'
  }
}; 