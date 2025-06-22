import React, { useState } from 'react';
import './GroupSection.css';

const GroupSection = ({ groups, clients, onRefresh, showToast }) => {
  const [selectedGroups, setSelectedGroups] = useState(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [selectedClients, setSelectedClients] = useState(new Set());
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedGroups(new Set(groups.map(g => g.id)));
    } else {
      setSelectedGroups(new Set());
    }
  };

  const handleGroupSelect = (groupId, checked) => {
    const newSelected = new Set(selectedGroups);
    if (checked) {
      newSelected.add(groupId);
    } else {
      newSelected.delete(groupId);
    }
    setSelectedGroups(newSelected);
  };

  const handleClientSelect = (clientId, checked) => {
    const newSelected = new Set(selectedClients);
    if (checked) {
      newSelected.add(clientId);
    } else {
      newSelected.delete(clientId);
    }
    setSelectedClients(newSelected);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (selectedClients.size === 0) {
      showToast('최소 하나 이상의 디스플레이 서버를 선택해주세요.', 'error');
      return;
    }

    const groupData = {
      ...formData,
      client_ids: Array.from(selectedClients)
    };

    if (editingGroup) {
      // 편집 모드
      showToast(`그룹 "${formData.name}"이(가) 수정되었습니다.`, 'success');
    } else {
      // 새 그룹 생성
      showToast(`새 그룹 "${formData.name}"이(가) 생성되었습니다.`, 'success');
    }

    setShowAddModal(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({ name: '', description: '' });
    setSelectedClients(new Set());
    setEditingGroup(null);
  };

  const openEditModal = (group) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      description: group.description || ''
    });
    setSelectedClients(new Set(group.client_ids));
    setShowAddModal(true);
  };

  const deleteGroup = (groupId) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    if (window.confirm(`정말 "${group.name}" 그룹을 삭제하시겠습니까?\n그룹만 삭제되고 클라이언트는 유지됩니다.`)) {
      showToast(`그룹 "${group.name}"이(가) 삭제되었습니다.`, 'error');
    }
  };

  const bulkAction = (action) => {
    if (selectedGroups.size === 0) {
      showToast('선택된 그룹이 없습니다.', 'error');
      return;
    }

    const actionNames = {
      'on': '켜기',
      'reboot': '재부팅',
      'off': '끄기'
    };

    const actionName = actionNames[action];
    const groupCount = selectedGroups.size;

    if (window.confirm(`선택된 ${groupCount}개 그룹의 모든 디스플레이 서버를 ${actionName} 하시겠습니까?`)) {
      let totalClients = 0;
      selectedGroups.forEach(groupId => {
        const group = groups.find(g => g.id === groupId);
        if (group) {
          totalClients += group.client_ids.length;
        }
      });

      showToast(`${groupCount}개 그룹 (${totalClients}대 클라이언트)에 전원 ${actionName} 명령을 전송했습니다. (v2.1에서 활성화)`, 'info');
    }
  };

  return (
    <div className="section">
      <h2 className="section-title">
        👥 디스플레이 서버 그룹
        <button 
          className="btn btn-secondary btn-with-text" 
          onClick={() => setShowAddModal(true)}
        >
          ➕ 새 그룹
        </button>
      </h2>
      
      {/* 그룹 일괄 제어 UI */}
      <div className="bulk-controls">
        <div className="selection-info">
          <label>
            <input 
              type="checkbox" 
              checked={selectedGroups.size === groups.length && groups.length > 0}
              onChange={handleSelectAll}
            />
            전체 선택
          </label>
          <span>선택된 그룹: <span>{selectedGroups.size}</span>개</span>
        </div>
        <div className="bulk-actions">
          <button
            className="btn btn-primary btn-bulk"
            onClick={() => bulkAction('on')}
            title="선택된 그룹들 전체 켜기"
          >
            켜기
          </button>
          <button
            className="btn btn-secondary btn-bulk"
            onClick={() => bulkAction('reboot')}
            title="선택된 그룹들 전체 재부팅"
          >
            재부팅
          </button>
          <button
            className="btn btn-danger btn-bulk"
            onClick={() => bulkAction('off')}
            title="선택된 그룹들 전체 끄기"
          >
            끄기
          </button>
        </div>
      </div>

      <div className="group-grid">
        {groups.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👥</div>
            <div className="empty-state-title">아직 생성된 그룹이 없습니다</div>
            <div className="empty-state-description">새 그룹 버튼을 클릭해서 첫 번째 그룹을 만들어보세요!</div>
          </div>
        ) : (
          groups.map(group => {
            const clientTags = group.client_ids.map(clientId => {
              const client = clients.find(c => c.id === clientId);
              return client ? (
                <span key={clientId} className="client-tag">
                  {client.ip_address}
                </span>
              ) : null;
            }).filter(Boolean);

            return (
              <div key={group.id} className="group-card">
                <input 
                  type="checkbox" 
                  className="group-checkbox"
                  checked={selectedGroups.has(group.id)}
                  onChange={(e) => handleGroupSelect(group.id, e.target.checked)}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="group-content">
                  <div className="group-name">{group.name}</div>
                  <div className="group-info">{group.client_ids.length}개 디스플레이 서버</div>
                  <div className="group-clients">
                    {clientTags}
                  </div>
                </div>
                <div className="group-actions">
                  <button
                    className="btn btn-secondary btn-bulk"
                    onClick={() => openEditModal(group)}
                    title="편집"
                  >
                    편집
                  </button>
                  <button
                    className="btn btn-danger btn-bulk"
                    onClick={() => deleteGroup(group.id)}
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

      {/* 그룹 추가/편집 모달 */}
      {showAddModal && (
        <div className="modal show">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editingGroup ? '👥 그룹 편집' : '👥 새 그룹 만들기'}</h3>
              <span className="close" onClick={() => setShowAddModal(false)}>&times;</span>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="groupName">👥 그룹 이름</label>
                <input 
                  type="text" 
                  id="groupName"
                  className="form-input" 
                  placeholder="예: 메인 디스플레이 월" 
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
                <small className="form-help">알아보기 쉬운 그룹 이름</small>
              </div>
              
              <div className="form-group">
                <label htmlFor="groupDescription">📝 설명 (선택)</label>
                <textarea 
                  id="groupDescription"
                  className="form-input" 
                  rows="2" 
                  placeholder="그룹에 대한 설명을 입력하세요 (위치, 용도 등)"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
              
              <div className="form-group">
                <label>🖥️ 포함할 디스플레이 서버</label>
                <div className="radio-group">
                  {clients.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                      🖥️ 먼저 클라이언트를 추가해주세요
                    </div>
                  ) : (
                    clients.map(client => (
                      <label 
                        key={client.id} 
                        className="radio-label"
                      >
                        <input 
                          type="checkbox" 
                          name="groupClients" 
                          value={client.id}
                          checked={selectedClients.has(client.id)}
                          onChange={(e) => handleClientSelect(client.id, e.target.checked)}
                        />
                        <span>{client.name} ({client.ip_address})</span>
                      </label>
                    ))
                  )}
                </div>
                <small className="form-help">그룹에 포함할 디스플레이 서버를 선택하세요. 한 클라이언트는 여러 그룹에 포함될 수 있습니다.</small>
              </div>
              
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

export default GroupSection; 