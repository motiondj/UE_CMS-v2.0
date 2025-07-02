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
  
  // Socket.IO 설정
  socket: {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    },
    pingInterval: 25000,
    pingTimeout: 60000,
    transports: ['websocket', 'polling']
  },
  
  // 데이터베이스 설정
  database: {
    filename: process.env.DB_FILE || './ue_cms.db',
    busyTimeout: 5000,
    verbose: process.env.NODE_ENV === 'development'
  },
  
  // 모니터링 설정
  monitoring: {
    healthCheckInterval: 15000,    // 15초
    offlineTimeout: 120000,        // 120초 (2분)
    connectionCheckInterval: 15000, // 15초
    processCheckInterval: 10000    // 10초
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