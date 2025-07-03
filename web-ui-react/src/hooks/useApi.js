import { useState, useCallback } from 'react';

const useApi = (baseUrl) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const request = useCallback(async (
    endpoint,
    options = {},
    retries = 3
  ) => {
    setLoading(true);
    setError(null);

    let lastError;
    
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(`${baseUrl}${endpoint}`, {
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
          ...options,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        setLoading(false);
        return { data, error: null };
        
      } catch (err) {
        lastError = err;
        console.error(`API 요청 실패 (시도 ${i + 1}/${retries}):`, err);
        
        // 마지막 시도가 아니면 대기 후 재시도
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
        }
      }
    }

    setError(lastError);
    setLoading(false);
    return { data: null, error: lastError };
  }, [baseUrl]);

  // 편의 메서드들
  const get = useCallback((endpoint, options) => 
    request(endpoint, { ...options, method: 'GET' }), [request]);
    
  const post = useCallback((endpoint, data, options) => 
    request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    }), [request]);
    
  const put = useCallback((endpoint, data, options) => 
    request(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    }), [request]);
    
  const del = useCallback((endpoint, options) => 
    request(endpoint, { ...options, method: 'DELETE' }), [request]);

  return {
    loading,
    error,
    get,
    post,
    put,
    delete: del,
    request,
  };
};

export default useApi; 