import React from 'react';
import './ToastContainer.css';

const ToastContainer = ({ toasts, onRemove }) => {
  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`toast toast-${toast.type}`}
          onClick={() => onRemove(toast.id)}
        >
          <div className="toast-content">{toast.message}</div>
          <button className="toast-close" onClick={() => onRemove(toast.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
};

export default ToastContainer; 