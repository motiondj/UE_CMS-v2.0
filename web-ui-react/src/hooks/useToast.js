import { useState, useCallback, useRef } from 'react';

const useToast = () => {
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);

  const showToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = toastIdRef.current++;
    const newToast = { id, message, type, duration };

    setToasts(prev => [...prev, newToast]);

    // 자동 제거
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, duration);

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  return {
    toasts,
    showToast,
    removeToast,
    clearToasts,
  };
};

export default useToast; 