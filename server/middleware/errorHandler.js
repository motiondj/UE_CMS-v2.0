const logger = require('../utils/logger');

// 커스텀 에러 클래스
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// 에러 핸들러
const errorHandler = (err, req, res, next) => {
  let { statusCode = 500, message } = err;
  
  // 로깅
  if (statusCode >= 500) {
    logger.error('서버 에러:', err);
  } else {
    logger.warn('클라이언트 에러:', err.message);
  }
  
  // 개발 환경에서는 에러 스택 포함
  const response = {
    success: false,
    error: message
  };
  
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }
  
  res.status(statusCode).json(response);
};

// 404 핸들러
const notFoundHandler = (req, res, next) => {
  const error = new AppError(`Cannot find ${req.originalUrl}`, 404);
  next(error);
};

module.exports = {
  AppError,
  errorHandler,
  notFoundHandler
}; 