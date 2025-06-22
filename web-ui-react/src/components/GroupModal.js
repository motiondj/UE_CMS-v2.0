import React, { useState, useEffect } from 'react';

const GroupModal = ({ onClose, onSave, editingGroup, clients }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    client_ids: []
  });

  useEffect(() => {
    if (editingGroup) {
      setFormData({
        name: editingGroup.name,
        description: editingGroup.description || '',
        client_ids: editingGroup.client_ids || []
      });
    }
  }, [editingGroup]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleClientChange = (clientId) => {
    setFormData(prev => ({
      ...prev,
      client_ids: prev.client_ids.includes(clientId)
        ? prev.client_ids.filter(id => id !== clientId)
        : [...prev.client_ids, clientId]
    }));
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{editingGroup ? '그룹 편집' : '새 그룹 만들기'}</h3>
          <span className="close" onClick={onClose}>&times;</span>
        </div>
        
        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="groupName">그룹 이름</label>
              <input 
                type="text" 
                id="groupName" 
                name="name"
                className="form-input" 
                placeholder="예: 메인 디스플레이 월" 
                value={formData.name}
                onChange={handleChange}
                required 
              />
              <small className="form-help">알아보기 쉬운 그룹 이름</small>
            </div>
            
            <div className="form-group">
              <label htmlFor="groupDescription">설명 (선택)</label>
              <textarea 
                id="groupDescription" 
                name="description"
                className="form-input" 
                rows="2" 
                placeholder="그룹에 대한 설명을 입력하세요 (위치, 용도 등)"
                value={formData.description}
                onChange={handleChange}
              />
            </div>
            
            <div className="form-group">
              <label>포함할 디스플레이 서버</label>
              <div className="checkbox-group">
                {clients.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                    먼저 클라이언트를 추가해주세요
                  </div>
                ) : (
                  clients.map(client => (
                    <label key={client.id} className="checkbox-label">
                      <input 
                        type="checkbox" 
                        checked={formData.client_ids.includes(client.id)}
                        onChange={() => handleClientChange(client.id)}
                      />
                      <span>{client.name} ({client.ip_address})</span>
                    </label>
                  ))
                )}
              </div>
              <small className="form-help">
                그룹에 포함할 디스플레이 서버를 선택하세요. 한 클라이언트는 여러 그룹에 포함될 수 있습니다.
                {formData.client_ids.length > 0 && (
                  <span style={{ color: '#22c55e' }}>
                    총 {formData.client_ids.length}개 클라이언트가 선택되었습니다.
                  </span>
                )}
              </small>
            </div>
            
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>취소</button>
              <button type="submit" className="btn btn-primary">저장</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default GroupModal; 