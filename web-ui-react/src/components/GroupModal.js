import React, { useState, useEffect } from 'react';

const GroupModal = ({ isOpen, onClose, onSave, clients, initialData }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    clientIds: []
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        description: initialData.description || '',
        clientIds: (initialData.clients || initialData.clientIds || []).map(c => typeof c === 'object' ? c.id : c)
      });
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleClientToggle = (clientId) => {
    setFormData(prev => {
      const exists = prev.clientIds.includes(clientId);
      return {
        ...prev,
        clientIds: exists
          ? prev.clientIds.filter(id => id !== clientId)
          : [...prev.clientIds, clientId]
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('그룹 이름은 필수입니다.');
      return;
    }
    if (formData.clientIds.length === 0) {
      alert('최소 하나 이상의 디스플레이 서버를 선택해주세요.');
      return;
    }
    setLoading(true);
    try {
      await onSave(formData);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal" style={{ display: 'flex' }}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{initialData ? '그룹 수정' : '그룹 추가'}</h2>
          <button className="close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="name">그룹 이름 *</label>
            <input
              type="text"
              id="name"
              name="name"
              className="form-input"
              value={formData.name}
              onChange={handleChange}
              placeholder="예: Display Group 1"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="description">설명 (선택)</label>
            <textarea
              id="description"
              name="description"
              className="form-input"
              rows="2"
              placeholder="그룹에 대한 설명을 입력하세요 (위치, 용도 등)"
              value={formData.description}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label className="form-label">그룹 클라이언트 선택 *</label>
            <div style={{ maxHeight: 150, overflowY: 'auto', border: '1px solid #eee', borderRadius: 6, padding: 8 }}>
              {clients.length === 0 ? (
                <div style={{ color: '#888', fontSize: 14 }}>등록된 클라이언트가 없습니다.</div>
              ) : (
                clients.map(client => (
                  <label key={client.id} style={{ display: 'block', marginBottom: 4 }}>
                    <input
                      type="checkbox"
                      checked={formData.clientIds.includes(client.id)}
                      onChange={() => handleClientToggle(client.id)}
                    />{' '}
                    {client.name} ({client.ip_address})
                  </label>
                ))
              )}
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>취소</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? '저장 중...' : '저장'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GroupModal; 