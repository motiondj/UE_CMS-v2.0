import React, { useEffect, useState } from 'react';
import './Toast.css';

const Toast = ({ message, type = 'info', duration = 4000, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (message) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => {
          onClose && onClose();
        }, 300); // 애니메이션 완료 후 제거
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [message, duration, onClose]);

  if (!message) return null;

  return (
    <div className={`toast ${type} ${isVisible ? 'show' : ''}`}>
      {message}
    </div>
  );
};

export default Toast; 