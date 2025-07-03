const env = process.env.REACT_APP_ENV || 'development';

const config = {
  // API 설정
  API_BASE: process.env.REACT_APP_API_BASE || 'http://localhost:8000',
  SOCKET_URL: process.env.REACT_APP_SOCKET_URL || 'http://localhost:8000',
  
  // 환경 정보
  ENV: env,
  IS_DEVELOPMENT: env === 'development',
  IS_PRODUCTION: env === 'production',
  IS_STAGING: env === 'staging',
  DEBUG_MODE: process.env.REACT_APP_DEBUG === 'true',
  
  // 타이밍 설정
  REFRESH_INTERVAL: parseInt(process.env.REACT_APP_REFRESH_INTERVAL || '5000'),
  HEARTBEAT_INTERVAL: parseInt(process.env.REACT_APP_HEARTBEAT_INTERVAL || '10000'),
  SYNC_INTERVAL: parseInt(process.env.REACT_APP_SYNC_INTERVAL || '5000'),
  TOAST_DURATION: parseInt(process.env.REACT_APP_TOAST_DURATION || '4000'),
  
  // 재시도 설정
  MAX_RETRY_ATTEMPTS: parseInt(process.env.REACT_APP_MAX_RETRY_ATTEMPTS || '3'),
  RETRY_DELAY: parseInt(process.env.REACT_APP_RETRY_DELAY || '1000'),
  
  // 기능 플래그
  FEATURES: {
    WAKE_ON_LAN: process.env.REACT_APP_FEATURE_WOL !== 'false',
    AUTO_REFRESH: process.env.REACT_APP_FEATURE_AUTO_REFRESH !== 'false',
    DARK_MODE: process.env.REACT_APP_FEATURE_DARK_MODE !== 'false',
    KEYBOARD_NAV: process.env.REACT_APP_FEATURE_KEYBOARD_NAV !== 'false',
  }
};

// 개발 환경에서만 설정 로깅
if (config.IS_DEVELOPMENT) {
  console.log('🔧 환경 설정:', config);
}

export default config; 