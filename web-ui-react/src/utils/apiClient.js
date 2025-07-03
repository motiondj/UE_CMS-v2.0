class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

const apiClient = {
  baseURL: process.env.REACT_APP_API_BASE || 'http://localhost:8000',
  maxRetries: 3,
  retryDelay: 1000,
  timeout: 10000, // 10초 타임아웃

  async request(url, options = {}, retries = this.maxRetries) {
    const fullUrl = `${this.baseURL}${url}`;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // 타임아웃 설정
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        const response = await fetch(fullUrl, {
          ...options,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
        });

        clearTimeout(timeoutId);

        // 성공 응답
        if (response.ok) {
          return await response.json();
        }

        // 4xx 에러는 재시도하지 않음
        if (response.status >= 400 && response.status < 500) {
          const errorData = await response.json().catch(() => ({}));
          throw new ApiError(
            errorData.error || `HTTP ${response.status}`,
            response.status,
            errorData
          );
        }

        // 5xx 에러는 재시도
        if (attempt < retries) {
          const delay = this.retryDelay * Math.pow(2, attempt);
          console.warn(`요청 실패, ${delay}ms 후 재시도... (${attempt + 1}/${retries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // 마지막 시도에서도 실패
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.error || `HTTP ${response.status}`,
          response.status,
          errorData
        );

      } catch (error) {
        // 타임아웃 에러
        if (error.name === 'AbortError') {
          if (attempt < retries) {
            const delay = this.retryDelay * Math.pow(2, attempt);
            console.warn(`타임아웃, ${delay}ms 후 재시도... (${attempt + 1}/${retries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          throw new ApiError('서버 응답 시간 초과', 0, null);
        }

        // 네트워크 에러
        if (error instanceof ApiError) {
          throw error;
        }

        if (attempt < retries) {
          const delay = this.retryDelay * Math.pow(2, attempt);
          console.warn(`네트워크 에러, ${delay}ms 후 재시도... (${attempt + 1}/${retries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        throw new ApiError('네트워크 연결을 확인해주세요', 0, null);
      }
    }
  },

  // 서버 상태 확인
  async healthCheck() {
    try {
      const response = await fetch(`${this.baseURL}/api/health`, {
        method: 'GET',
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000) // 5초 타임아웃
      });
      return response.ok;
    } catch (error) {
      console.log('서버 상태 확인 실패:', error);
      return false;
    }
  },

  // 연결 상태 모니터링
  async monitorConnection(callback) {
    let isConnected = false;
    
    const checkConnection = async () => {
      const connected = await this.healthCheck();
      if (connected !== isConnected) {
        isConnected = connected;
        callback(connected);
      }
    };
    
    // 초기 확인
    await checkConnection();
    
    // 주기적 확인 (10초마다)
    const interval = setInterval(checkConnection, 10000);
    
    return () => clearInterval(interval);
  },

  // 편의 메서드들
  get(url, options) {
    return this.request(url, { ...options, method: 'GET' });
  },

  post(url, data, options) {
    return this.request(url, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  put(url, data, options) {
    return this.request(url, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete(url, options) {
    return this.request(url, { ...options, method: 'DELETE' });
  },
};

export default apiClient; 