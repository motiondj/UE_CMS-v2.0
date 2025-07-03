import React from 'react';
import Modal from './Modal';
import './ConfirmDialog.css';

const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = '확인',
  message,
  confirmText = '확인',
  cancelText = '취소',
  type = 'default' // default, danger, warning
}) => {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="small"
      closeOnOverlayClick={false}
    >
      <div className="confirm-dialog-content">
        <p className="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button
            className="btn btn-secondary"
            onClick={onClose}
          >
            {cancelText}
          </button>
          <button
            className={`btn btn-${type === 'danger' ? 'danger' : 'primary'}`}
            onClick={handleConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmDialog; 