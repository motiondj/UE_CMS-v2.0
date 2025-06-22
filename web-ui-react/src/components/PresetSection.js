import React, { useState } from 'react';

const PresetSection = ({ presets, groups, clients, apiBase, showToast }) => {
  const [showModal, setShowModal] = useState(false);
  const [editingPreset, setEditingPreset] = useState(null);
  const [selectedPresets, setSelectedPresets] = useState(new Set());
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    target_group_id: null,
    client_commands: {},
  });

  const safeGroups = groups || [];
  
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      target_group_id: null,
      client_commands: {},
    });
    setEditingPreset(null);
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (preset) => {
    setEditingPreset(preset);
    const commands = typeof preset.client_commands === 'string' 
      ? JSON.parse(preset.client_commands) 
      : preset.client_commands;

    setFormData({
      name: preset.name || '',
      description: preset.description || '',
      target_group_id: preset.target_group_id || null,
      client_commands: commands || {},
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const handleGroupSelect = (groupId) => {
    setFormData(prev => ({
      ...prev,
      target_group_id: groupId,
      client_commands: {}, // 그룹 변경 시 명령어 초기화
    }));
  };
  
  const handleCommandChange = (clientId, command) => {
    setFormData(prev => ({
      ...prev,
      client_commands: {
        ...prev.client_commands,
        [clientId]: command,
      },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name) {
      showToast('📋 프리셋 이름을 입력해주세요.', 'error');
      return;
    }

    if (!formData.target_group_id) {
      showToast('🎯 대상 그룹을 선택해주세요.', 'error');
      return;
    }

    const selectedGroupForSubmit = safeGroups.find(g => g.id === formData.target_group_id);
    if (selectedGroupForSubmit && selectedGroupForSubmit.clients) {
      for (const client of selectedGroupForSubmit.clients) {
        if (!formData.client_commands[client.id] || formData.client_commands[client.id].trim() === '') {
          showToast(`🖥️ 클라이언트 "${client.name}"의 명령어를 입력해주세요.`, 'error');
          return;
        }
      }
    }

    const isEditing = !!editingPreset;
    const url = `${apiBase}/api/presets` + (isEditing ? `/${editingPreset.id}` : '');
    const method = isEditing ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `프리셋 ${isEditing ? '수정' : '생성'} 실패`);
      }
      
      showToast(`프리셋 "${result.name}"이(가) 성공적으로 ${isEditing ? '수정' : '생성'}되었습니다.`, 'success');
      closeModal();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const deletePreset = async (presetId) => {
    if (window.confirm('정말 이 프리셋을 삭제하시겠습니까?')) {
      try {
        const response = await fetch(`${apiBase}/api/presets/${presetId}`, { method: 'DELETE' });
        if (!response.ok) {
            const data = await response.json();
          throw new Error(data.error || '프리셋 삭제 실패');
        }
        showToast('프리셋이 성공적으로 삭제되었습니다.', 'success');
      } catch (error) {
        showToast(error.message, 'error');
      }
    }
  };
  
  const runPreset = async (preset) => {
    try {
      const response = await fetch(`${apiBase}/api/presets/${preset.id}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '프리셋 실행 실패');
      }
      
      const result = await response.json();
      
      // 실행 결과 토스트 표시
      if (result.warning) {
        showToast(result.warning, 'warning');
      }
      
      if (result.warnings && result.warnings.length > 0) {
        result.warnings.forEach(warning => {
          showToast(warning, 'warning');
        });
      }
      
      // 실행 요약 토스트
      const summary = result.summary;
      if (summary) {
        const message = `프리셋 "${preset.name}" 실행 완료: ${summary.executed}/${summary.total}개 클라이언트 (온라인: ${summary.online}, 오프라인: ${summary.offline})`;
        showToast(message, summary.offline > 0 ? 'warning' : 'success');
      } else {
        showToast(`프리셋 "${preset.name}" 실행이 시작되었습니다.`, 'success');
      }
    } catch (error) {
      showToast(`프리셋 실행 실패: ${error.message}`, 'error');
    }
  };

  const bulkPresetAction = (action) => {
    if (selectedPresets.size === 0) {
        showToast('선택된 프리셋이 없습니다.', 'error');
        return;
    }
    const actionMap = {
      'execute': '실행',
      'stop': '정지',
      'delete': '삭제'
    };
    showToast(`일괄 ${actionMap[action]} 기능은 구현 예정입니다.`, 'info');
  }

  const handleSelectPreset = (presetId, isChecked) => {
      setSelectedPresets(prev => {
          const newSelection = new Set(prev);
          if (isChecked) {
              newSelection.add(presetId);
          } else {
              newSelection.delete(presetId);
          }
          return newSelection;
      });
  };

  const handleSelectAll = (e) => {
      if (e.target.checked) {
          const allPresetIds = new Set((presets || []).map(p => p.id));
          setSelectedPresets(allPresetIds);
      } else {
          setSelectedPresets(new Set());
      }
  };

  const isAllSelected = (presets || []).length > 0 && selectedPresets.size === (presets || []).length;
  const selectedGroup = safeGroups.find(g => g.id === formData.target_group_id);

  return (
    <div className="section">
      <h2 className="section-title">
        📋 콘텐츠 프리셋
        <button className="btn btn-secondary btn-with-text" onClick={openAddModal}>
            ➕ 새 프리셋
        </button>
      </h2>
      
      <div className="bulk-controls">
          <div className="selection-info">
              <label>
                  <input type="checkbox" 
                      onChange={handleSelectAll}
                      checked={isAllSelected}
                      disabled={(presets || []).length === 0}
                  />
                  전체 선택
              </label>
              <span>선택된 프리셋: {selectedPresets.size}개</span>
          </div>
          <div className="bulk-actions">
              <button className="btn btn-primary btn-bulk" onClick={() => bulkPresetAction('execute')} title="선택된 프리셋들 전체 실행">
                  실행
              </button>
              <button className="btn btn-danger btn-bulk" onClick={() => bulkPresetAction('stop')} title="선택된 프리셋들 전체 정지">
                  정지
              </button>
              <button className="btn btn-danger btn-bulk" onClick={() => bulkPresetAction('delete')} title="선택된 프리셋들 전체 삭제">
                  삭제
              </button>
          </div>
      </div>

      <div className="preset-grid">
          {presets && presets.length > 0 ? (
              presets.map(preset => {
                  const group = safeGroups.find(g => g.id === preset.target_group_id);
                  const clientCount = group ? (group.clients || []).length : 0;
                  return (
                      <div key={preset.id} id={`preset-${preset.id}`} className={`preset-card ${preset.is_active ? 'active' : ''}`}>
                          <input 
                              type="checkbox" 
                              className="preset-checkbox" 
                              data-preset-id={preset.id} 
                              checked={selectedPresets.has(preset.id)}
                              onChange={(e) => handleSelectPreset(preset.id, e.target.checked)}
                              onClick={(e) => e.stopPropagation()}
                          />
                          <div className="preset-content">
                              <div className="preset-name">{preset.name}</div>
                              {preset.description && <div className="preset-info">{preset.description}</div>}
                              <div className="preset-info">그룹: {group ? group.name : '삭제된 그룹'}</div>
                              <div className="preset-info">{clientCount}대 클라이언트</div>
                          </div>
                          <div className="preset-actions">
                              <button className="btn btn-primary btn-bulk" onClick={() => runPreset(preset)} title="실행">실행</button>
                              <button className="btn btn-secondary btn-bulk" onClick={() => openEditModal(preset)} title="편집">편집</button>
                              <button className="btn btn-danger btn-bulk" onClick={() => deletePreset(preset.id)} title="삭제">삭제</button>
                          </div>
                      </div>
                  );
              })
          ) : (
              <div className="empty-state">
                  <div className="empty-state-icon">📝</div>
                  <div className="empty-state-title">아직 생성된 프리셋이 없습니다</div>
                  <div className="empty-state-description">새 프리셋 버튼을 클릭해서 첫 번째 프리셋을 만들어보세요!</div>
              </div>
          )}
      </div>

    {showModal && (
      <div className="modal show" onClick={closeModal}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3 id="presetModalTitle">{editingPreset ? '📋 프리셋 편집' : '📋 새 프리셋 만들기'}</h3>
            <span className="close" onClick={closeModal}>&times;</span>
          </div>
          <form id="presetForm" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="presetName">📋 프리셋 이름</label>
              <input
                type="text"
                id="presetName"
                className="form-input"
                placeholder="예: 메인 콘텐츠"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>🎯 대상 그룹 선택 (필수)</label>
              <div className="radio-group" id="presetGroupList">
                {safeGroups.length === 0 ? (
                   <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                     👥 먼저 그룹을 생성해주세요
                   </div>
                ) : (
                  safeGroups.map(group => (
                    <label 
                      key={group.id} 
                      className={`radio-label ${formData.target_group_id === group.id ? 'selected' : ''}`}
                    >
                      <input 
                        type="radio" 
                        name="presetGroup" 
                        value={group.id}
                        checked={formData.target_group_id === group.id}
                        onChange={() => handleGroupSelect(group.id)}
                      />
                      <span>
                        <strong>{group.name}</strong><br />
                        <small style={{ color: 'var(--text-muted)' }}>
                          {(group.clients || []).length}개 클라이언트: {(group.clients || []).map(c => c.name).join(', ')}
                        </small>
                      </span>
                    </label>
                  ))
                )}
              </div>
               <small className="form-help">📌 그룹을 선택하면 해당 클라이언트별로 명령어를 설정할 수 있습니다</small>
            </div>

            {selectedGroup && (
              <div className="client-command-section" id="clientCommandSection">
                 <div className="client-command-header">
                   <h4>🖥️ 클라이언트별 언리얼엔진 실행 명령어</h4>
                     <span id="selectedGroupName" style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                       선택된 그룹: {selectedGroup.name}
                     </span>
                 </div>
                <div id="clientCommandsList">
                  {(selectedGroup.clients || []).map(client => (
                    <div key={client.id} className="client-command-item">
                       <label htmlFor={`command_${client.id}`}>
                         🖥️ {client.name} ({client.ip_address})
                       </label>
                       <input 
                         type="text" 
                         id={`command_${client.id}`}
                         className="form-input" 
                         placeholder={`예: D:\\...\\MyProject.exe -dc_node=Node_0 -fullscreen`}
                         value={formData.client_commands[client.id] || ''}
                         onChange={(e) => handleCommandChange(client.id, e.target.value)}
                         required
                       />
                       <small className="form-help">💡 이 클라이언트에서 실행될 완전한 명령어를 입력하세요.</small>
                     </div>
                  ))}
                </div>
                <small className="form-help">
                  💡 <strong>팁:</strong> 각 클라이언트별로 다른 nDisplay 노드를 설정하세요<br />
                  예시: <code>D:\\...\\MyProject.exe -dc_node=Node_0 -fullscreen</code>
                </small>
              </div>
            )}

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={closeModal}>취소</button>
              <button type="submit" className="btn btn-primary">저장</button>
            </div>
          </form>
        </div>
      </div>
    )}
  </div>
);
};

export default PresetSection; 