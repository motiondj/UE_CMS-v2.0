import React, { useState, useEffect } from 'react';

const PresetModal = ({ onClose, onSave, groups, preset }) => {
  const [formData, setFormData] = useState({
    name: '',
    command: '',
    target_group_id: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (preset) {
      setFormData({
        name: preset.name || '',
        command: preset.command || '',
        target_group_id: preset.target_group_id || ''
      });
    }
  }, [preset]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.command.trim()) {
      alert('프리셋 이름과 명령어는 필수입니다.');
      return;
    }
    setLoading(true);
    try {
      await onSave(formData);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{preset ? '프리셋 수정' : '프리셋 추가'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="name">프리셋 이름 *</label>
            <input
              type="text"
              id="name"
              name="name"
              className="form-input"
              value={formData.name}
              onChange={handleChange}
              placeholder="예: Unreal Launch"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="command">명령어 *</label>
            <textarea
              id="command"
              name="command"
              className="form-textarea"
              value={formData.command}
              onChange={handleChange}
              placeholder="예: unreal://launch/C:/Project/Project.uproject"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="target_group_id">대상 그룹</label>
            <select
              id="target_group_id"
              name="target_group_id"
              className="form-select"
              value={formData.target_group_id}
              onChange={handleChange}
            >
              <option value="">(선택 안 함)</option>
              {groups.map(group => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
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

export default PresetModal; 