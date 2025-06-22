import React, { useState, useEffect } from 'react';
import './PresetSection.css';

const PresetSection = ({ presets, groups, onRefresh, showToast }) => {
  const [selectedPresets, setSelectedPresets] = useState(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPreset, setEditingPreset] = useState(null);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [clientCommands, setClientCommands] = useState({});
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedPresets(new Set(presets.map(p => p.id)));
    } else {
      setSelectedPresets(new Set());
    }
  };

  const handlePresetSelect = (presetId, checked) => {
    const newSelected = new Set(selectedPresets);
    if (checked) {
      newSelected.add(presetId);
    } else {
      newSelected.delete(presetId);
    }
    setSelectedPresets(newSelected);
  };

  const handleGroupSelect = (groupId) => {
    setSelectedGroupId(groupId);
    const group = groups.find(g => g.id === groupId);
    if (group) {
      const commands = {};
      group.client_ids.forEach(clientId => {
        commands[clientId] = '';
      });
      setClientCommands(commands);
    }
  };

  const handleCommandChange = (clientId, command) => {
    setClientCommands(prev => ({
      ...prev,
      [clientId]: command
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!selectedGroupId) {
      showToast('대상 그룹을 선택해주세요.', 'error');
      return;
    }

    const hasEmptyCommand = Object.values(clientCommands).some(cmd => !cmd.trim());
    if (hasEmptyCommand) {
      showToast('모든 클라이언트의 명령어를 입력해주세요.', 'error');
      return;
    }

    const presetData = {
      ...formData,
      group_id: selectedGroupId,
      client_commands: clientCommands
    };

    if (editingPreset) {
      // 편집 모드
      showToast(`프리셋 "${formData.name}"이(가) 수정되었습니다.`, 'success');
    } else {
      // 새 프리셋 생성
      showToast(`새 프리셋 "${formData.name}"이(가) 생성되었습니다.`, 'success');
    }

    setShowAddModal(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({ name: '', description: '' });
    setSelectedGroupId(null);
    setClientCommands({});
    setEditingPreset(null);
  };

  const openEditModal = (preset) => {
    setEditingPreset(preset);
    setFormData({
      name: preset.name,
      description: preset.description || ''
    });
    setSelectedGroupId(preset.group_id);
    setClientCommands(preset.client_commands || {});
    setShowAddModal(true);
  };

  const executePreset = (presetId) => {
    const preset = presets.find(p => p.id === presetId);
    if (!preset) return;

    const group = groups.find(g => g.id === preset.group_id);
    if (!group) {
      showToast('연결된 그룹을 찾을 수 없습니다.', 'error');
      return;
    }

    const onlineClients = group.client_ids.filter(clientId => {
      // 실제로는 클라이언트 상태를 확인해야 함
      return true;
    });

    if (onlineClients.length === 0) {
      showToast('실행 가능한 온라인 클라이언트가 없습니다.', 'error');
      return;
    }

    showToast(`프리셋 "${preset.name}"이(가) ${onlineClients.length}개 클라이언트에서 실행되었습니다.`, 'success');
  };

  const deletePreset = (presetId) => {
    const preset = presets.find(p => p.id === presetId);
    if (!preset) return;

    if (window.confirm(`정말 "${preset.name}" 프리셋을 삭제하시겠습니까?\n실행 중인 경우 자동으로 중지됩니다.`)) {
      showToast(`프리셋 "${preset.name}"이(가) 삭제되었습니다.`, 'error');
    }
  };

  const bulkAction = (action) => {
    if (selectedPresets.size === 0) {
      showToast('선택된 프리셋이 없습니다.', 'error');
      return;
    }

    const actionNames = {
      'execute': '실행',
      'stop': '정지',
      'delete': '삭제'
    };

    const actionName = actionNames[action];
    const presetCount = selectedPresets.size;

    if (action === 'delete') {
      if (window.confirm(`선택된 ${presetCount}개 프리셋을 모두 삭제하시겠습니까?\n실행 중인 프리셋은 자동으로 중지됩니다.`)) {
        showToast(`${presetCount}개 프리셋이 삭제되었습니다.`, 'error');
        setSelectedPresets(new Set());
      }
    } else if (action === 'execute') {
      if (window.confirm(`선택된 ${presetCount}개 프리셋을 모두 실행하시겠습니까?`)) {
        showToast(`${presetCount}개 프리셋이 실행되었습니다.`, 'success');
      }
    } else if (action === 'stop') {
      if (window.confirm(`선택된 ${presetCount}개 프리셋을 모두 정지하시겠습니까?`)) {
        showToast(`${presetCount}개 프리셋이 정지되었습니다.`, 'success');
      }
    }
  };

  const selectedGroup = groups.find(g => g.id === selectedGroupId);

  return (
    <div className="section">
      <h2 className="section-title">
        📋 콘텐츠 프리셋
        <button 
          className="btn btn-secondary btn-with-text" 
          onClick={() => setShowAddModal(true)}
        >
          ➕ 새 프리셋
        </button>
      </h2>
      
      {/* 프리셋 일괄 제어 UI */}
      <div className="bulk-controls">
        <div className="selection-info">
          <label>
            <input 
              type="checkbox" 
              checked={selectedPresets.size === presets.length && presets.length > 0}
              onChange={handleSelectAll}
            />
            전체 선택
          </label>
          <span>선택된 프리셋: <span>{selectedPresets.size}</span>개</span>
        </div>
        <div className="bulk-actions">
          <button
            className="btn btn-primary btn-bulk"
            onClick={() => bulkAction('execute')}
            title="선택된 프리셋들 전체 실행"
          >
            실행
          </button>
          <button
            className="btn btn-danger btn-bulk"
            onClick={() => bulkAction('stop')}
            title="선택된 프리셋들 전체 정지"
          >
            정지
          </button>
          <button
            className="btn btn-danger btn-bulk"
            onClick={() => bulkAction('delete')}
            title="선택된 프리셋들 전체 삭제"
          >
            삭제
          </button>
        </div>
      </div>

      <div className="preset-grid">
        {presets.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📝</div>
            <div className="empty-state-title">아직 생성된 프리셋이 없습니다</div>
            <div className="empty-state-description">새 프리셋 버튼을 클릭해서 첫 번째 프리셋을 만들어보세요!</div>
          </div>
        ) : (
          presets.map(preset => {
            const group = groups.find(g => g.id === preset.group_id);
            const groupName = group ? group.name : '삭제된 그룹';
            const clientCount = group ? group.client_ids.length : 0;

            return (
              <div key={preset.id} className={`preset-card ${preset.is_active ? 'active' : ''}`}>
                <input 
                  type="checkbox" 
                  className="preset-checkbox"
                  checked={selectedPresets.has(preset.id)}
                  onChange={(e) => handlePresetSelect(preset.id, e.target.checked)}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="preset-content">
                  <div className="preset-name">{preset.name}</div>
                  {preset.description && <div className="preset-info">{preset.description}</div>}
                  <div className="preset-info">그룹: {groupName}</div>
                  <div className="preset-info">{clientCount}대 클라이언트</div>
                </div>
                <div className="preset-actions">
                  <button 
                    className="btn btn-primary btn-bulk" 
                    onClick={() => executePreset(preset.id)}
                    title="실행"
                  >
                    실행
                  </button>
                  <button 
                    className="btn btn-secondary btn-bulk" 
                    onClick={() => openEditModal(preset)}
                    title="편집"
                  >
                    편집
                  </button>
                  <button 
                    className="btn btn-danger btn-bulk" 
                    onClick={() => deletePreset(preset.id)}
                    title="삭제"
                  >
                    삭제
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 프리셋 추가/편집 모달 */}
      {showAddModal && (
        <div className="modal show">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editingPreset ? '📋 프리셋 편집' : '📋 새 프리셋 만들기'}</h3>
              <span className="close" onClick={() => setShowAddModal(false)}>&times;</span>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="presetName">📋 프리셋 이름</label>
                <input 
                  type="text" 
                  id="presetName"
                  className="form-input" 
                  placeholder="예: 메인 콘텐츠" 
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
                <small className="form-help">알아보기 쉬운 프리셋 이름</small>
              </div>
              
              <div className="form-group">
                <label htmlFor="presetDescription">📝 설명 (선택)</label>
                <textarea 
                  id="presetDescription"
                  className="form-input" 
                  rows="2" 
                  placeholder="프리셋에 대한 설명을 입력하세요"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
              
              <div className="form-group">
                <label>🎯 대상 그룹 선택 (필수)</label>
                <div className="radio-group">
                  {groups.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                      👥 먼저 그룹을 생성해주세요
                    </div>
                  ) : (
                    groups.map(group => (
                      <label 
                        key={group.id} 
                        className={`radio-label ${selectedGroupId === group.id ? 'selected' : ''}`}
                      >
                        <input 
                          type="radio" 
                          name="presetGroup" 
                          value={group.id}
                          checked={selectedGroupId === group.id}
                          onChange={() => handleGroupSelect(group.id)}
                        />
                        <span>
                          <strong>{group.name}</strong><br />
                          <small style={{ color: 'var(--text-muted)' }}>
                            {group.client_ids.length}개 클라이언트
                          </small>
                        </span>
                      </label>
                    ))
                  )}
                </div>
                <small className="form-help">📌 그룹을 선택하면 해당 클라이언트별로 명령어를 설정할 수 있습니다</small>
              </div>
              
              {/* 클라이언트별 명령어 섹션 */}
              {selectedGroup && (
                <div className="client-command-section">
                  <div className="client-command-header">
                    <h4>🖥️ 클라이언트별 언리얼엔진 실행 명령어</h4>
                    <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                      선택된 그룹: {selectedGroup.name}
                    </span>
                  </div>
                  {selectedGroup.client_ids.map(clientId => (
                    <div key={clientId} className="client-command-item">
                      <label htmlFor={`command_${clientId}`}>
                        🖥️ 클라이언트 {clientId}
                      </label>
                      <input 
                        type="text" 
                        id={`command_${clientId}`}
                        className="form-input" 
                        placeholder="예: D:\UnrealProjects\MyProject\Windows\MyProject.exe -dc_node=Node_0 -fullscreen"
                        value={clientCommands[clientId] || ''}
                        onChange={(e) => handleCommandChange(clientId, e.target.value)}
                        required
                      />
                      <small style={{ color: 'var(--text-muted)', fontSize: '10px', display: 'block', marginTop: '4px' }}>
                        💡 이 클라이언트에서 실행될 완전한 명령어를 입력하세요
                      </small>
                    </div>
                  ))}
                  <small className="form-help">
                    💡 <strong>팁:</strong> 각 클라이언트별로 다른 nDisplay 노드를 설정하세요<br />
                    예시: <code>D:\UnrealProjects\MyProject\Windows\MyProject.exe -dc_node=Node_0 -fullscreen</code>
                  </small>
                </div>
              )}
              
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  취소
                </button>
                <button type="submit" className="btn btn-primary">
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PresetSection; 