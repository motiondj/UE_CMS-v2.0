import React, { useState, useEffect } from 'react';

const PresetModal = ({ onClose, onSave, editingPreset, groups, clients }) => {
  console.log('프리셋 모달이 받은 그룹 데이터:', groups);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    group_id: null,
    client_commands: {}
  });

  // editingPreset이 변경될 때만 폼 데이터를 설정합니다.
  useEffect(() => {
    if (editingPreset && groups.length > 0) {
      const groupExists = groups.some(g => g.id === editingPreset.group_id);
      setFormData({
        name: editingPreset.name || '',
        description: editingPreset.description || '',
        group_id: groupExists ? editingPreset.group_id : null,
        client_commands: editingPreset.client_commands || {}
      });
    } else {
      // 새 프리셋을 만들거나 수정할 프리셋이 없을 경우 폼 초기화
      setFormData({
        name: '',
        description: '',
        group_id: null,
        client_commands: {}
      });
    }
  }, [editingPreset, groups]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.group_id) {
      alert('대상 그룹을 선택해주세요.');
      return;
    }
    
    const group = groups.find(g => g.id === formData.group_id);
    if (group) {
      const hasEmptyCommand = (group.client_ids || []).some(clientId => {
        const command = formData.client_commands[clientId];
        return !command || command.trim() === '';
      });
      
      if (hasEmptyCommand) {
        alert('모든 클라이언트의 명령어를 입력해주세요.');
        return;
      }
    }
    
    onSave(formData);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleGroupSelect = (groupId) => {
    setFormData(prev => ({
      ...prev,
      group_id: groupId,
      client_commands: {} // 그룹 변경 시 명령어 초기화
    }));
  };

  const handleCommandChange = (clientId, command) => {
    setFormData(prev => ({
      ...prev,
      client_commands: {
        ...prev.client_commands,
        [clientId]: command
      }
    }));
  };
  
  const selectedGroup = formData.group_id ? groups.find(g => g.id === formData.group_id) : null;

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 id="presetModalTitle">
            {editingPreset ? '📋 프리셋 편집' : '📋 새 프리셋 만들기'}
          </h3>
          <span className="close" onClick={onClose}>&times;</span>
        </div>
        
        <div className="modal-body">
          <form id="presetForm" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="presetName">📋 프리셋 이름</label>
              <input 
                type="text" 
                id="presetName"
                name="name"
                className="form-input" 
                placeholder="예: 메인 콘텐츠" 
                value={formData.name}
                onChange={handleChange}
                required 
              />
              <small className="form-help">알아보기 쉬운 프리셋 이름</small>
            </div>
            
            <div className="form-group">
              <label htmlFor="presetDescription">설명 (선택)</label>
              <textarea 
                id="presetDescription"
                name="description"
                className="form-input" 
                rows="2" 
                placeholder="프리셋에 대한 설명을 입력하세요"
                value={formData.description}
                onChange={handleChange}
              />
            </div>
            
            {/* 2단계: 대상 그룹 선택 (샘플과 동일한 라디오 버튼) */}
            <div className="form-group">
              <label>🎯 대상 그룹 선택 (필수)</label>
              <div className="radio-group" id="presetGroupList">
                {groups.length > 0 ? (
                  groups.map(group => (
                    <label 
                      key={group.id} 
                      className={`radio-label ${formData.group_id === group.id ? 'selected' : ''}`}
                    >
                      <input 
                        type="radio" 
                        name="presetGroup" 
                        value={group.id}
                        checked={formData.group_id === group.id}
                        onChange={() => handleGroupSelect(group.id)}
                      />
                      <span>
                        <strong>{group.name}</strong><br/>
                        <small style={{color: 'var(--text-muted)'}}>
                          {group.client_ids?.length || 0}개 클라이언트
                        </small>
                      </span>
                    </label>
                  ))
                ) : (
                  <div style={{textAlign: 'center', padding: '20px', color: 'var(--text-muted)'}}>
                    먼저 그룹을 생성해주세요
                  </div>
                )}
              </div>
              <small className="form-help">📌 그룹을 선택하면 해당 클라이언트별로 명령어를 설정할 수 있습니다</small>
            </div>
            
            {/* 3단계: 선택된 그룹의 클라이언트별 명령어 설정 */}
            {selectedGroup && (
              <div className="client-command-section" id="clientCommandSection">
                <div className="client-command-header">
                  <h4>🖥️ 클라이언트별 언리얼엔진 실행 명령어</h4>
                  <span id="selectedGroupName" style={{color: 'var(--text-muted)', fontSize: '12px'}}>
                    선택된 그룹: {selectedGroup.name}
                  </span>
                </div>
                <div id="clientCommandsList">
                  {(selectedGroup.client_ids || []).map((clientId, index) => {
                    const client = clients.find(c => c.id === clientId);
                    if (!client) return null;
                    
                    return (
                      <div key={clientId} className="client-command-item">
                        <label htmlFor={`command_${clientId}`}>
                          🖥️ {client.name} ({client.ip_address})
                        </label>
                        <input 
                          type="text" 
                          id={`command_${clientId}`}
                          data-client-id={clientId}
                          className="form-input" 
                          placeholder={`예: D:\\UnrealProjects\\MyProject\\Windows\\MyProject.exe -dc_node=Node_${index} -fullscreen`}
                          value={formData.client_commands[clientId] || ''}
                          onChange={(e) => handleCommandChange(clientId, e.target.value)}
                          required
                        />
                      </div>
                    );
                  })}
                </div>
                <small className="form-help">
                  💡 <strong>팁:</strong> 각 클라이언트별로 다른 nDisplay 노드를 설정하세요<br/>
                  예시: <code>D:\UnrealProjects\MyProject\Windows\MyProject.exe -dc_node=Node_0 -fullscreen</code>
                </small>
              </div>
            )}
            
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

export default PresetModal; 