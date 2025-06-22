import React, { useState } from 'react';

const AddClientModal = ({ onClose, onAdd }) => {
  const [formData, setFormData] = useState({
    name: '',
    ip_address: '',
    port: 8081
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.ip_address.trim()) {
      alert('이름과 IP 주소는 필수입니다.');
      return;
    }

    setLoading(true);
    try {
      await onAdd(formData);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">클라이언트 추가</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="name">
              클라이언트 이름 *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              className="form-input"
              value={formData.name}
              onChange={handleChange}
              placeholder="예: Display-PC-01"
              required
            />
          </div>
          
          <div className="form-group">
            <label className="form-label" htmlFor="ip_address">
              IP 주소 *
            </label>
            <input
              type="text"
              id="ip_address"
              name="ip_address"
              className="form-input"
              value={formData.ip_address}
              onChange={handleChange}
              placeholder="예: 192.168.1.100"
              required
            />
          </div>
          
          <div className="form-group">
            <label className="form-label" htmlFor="port">
              포트
            </label>
            <input
              type="number"
              id="port"
              name="port"
              className="form-input"
              value={formData.port}
              onChange={handleChange}
              placeholder="8081"
              min="1"
              max="65535"
            />
          </div>
          
          <div className="modal-actions">
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              취소
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? '추가 중...' : '추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddClientModal; 