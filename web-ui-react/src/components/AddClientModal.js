import React, { useState } from 'react';

const AddClientModal = ({ onClose, onAddClient }) => {
  const [formData, setFormData] = useState({
    name: '',
    ip_address: '',
    port: 8081,
    description: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onAddClient(formData);
    onClose();
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>새 디스플레이 서버 추가</h3>
          <span className="close" onClick={onClose}>&times;</span>
        </div>
        
        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="clientName">클라이언트 이름</label>
              <input 
                type="text" 
                id="clientName" 
                name="name"
                className="form-input" 
                placeholder="예: Display_01" 
                value={formData.name}
                onChange={handleChange}
                required 
              />
              <small className="form-help">알아보기 쉬운 이름을 지정하세요 (중복 불가)</small>
            </div>
            
            <div className="form-group">
              <label htmlFor="clientIP">IP 주소</label>
              <input 
                type="text" 
                id="clientIP" 
                name="ip_address"
                className="form-input" 
                placeholder="192.168.1.101" 
                pattern="^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$"
                value={formData.ip_address}
                onChange={handleChange}
                required 
              />
              <small className="form-help">클라이언트 PC의 고정 IP 주소</small>
            </div>
            
            <div className="form-group">
              <label htmlFor="clientPort">포트</label>
              <input 
                type="number" 
                id="clientPort" 
                name="port"
                className="form-input" 
                placeholder="8081" 
                value={formData.port}
                onChange={handleChange}
                min="1" 
                max="65535"
              />
              <small className="form-help">Python 클라이언트 통신 포트 (기본: 8081)</small>
            </div>
            
            <div className="form-group">
              <label htmlFor="clientDescription">설명 (선택)</label>
              <textarea 
                id="clientDescription" 
                name="description"
                className="form-input" 
                rows="2" 
                placeholder="이 클라이언트에 대한 메모 (위치, 용도 등)"
                value={formData.description}
                onChange={handleChange}
              />
            </div>
            
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>취소</button>
              <button type="submit" className="btn btn-primary">추가</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddClientModal; 